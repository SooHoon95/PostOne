import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { publishMultiMock, ensureFreshMock } = vi.hoisted(() => ({
  publishMultiMock: vi.fn(),
  ensureFreshMock: vi.fn(),
}));

vi.mock("@/lib/posts/publish-core", () => ({
  publishMultiForUser: publishMultiMock,
}));

vi.mock("@/lib/connections/token-core", () => ({
  ensureFreshConnections: ensureFreshMock,
  refreshConnectionForUser: vi.fn(),
  listExpiringConnections: vi.fn(),
}));

import {
  parseScheduledAt,
  parseScheduledPayload,
  toScheduledPostView,
  type ScheduledPostRow,
} from "@/lib/scheduling/queries";
import { validateMultiPublishInput } from "@/lib/posts/validate";
import { isAuthorizedCron, runPublishCron } from "@/lib/scheduling/cron";
import { publishScheduledPost } from "@/lib/scheduling/publish";
import type { MultiPublishInput } from "@/lib/posts/types";

beforeEach(() => {
  publishMultiMock.mockReset();
  ensureFreshMock.mockReset().mockResolvedValue([]);
});

// ─── 공통 헬퍼 ───────────────────────────────────────────────────────────────

function thenable(value: unknown) {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = () => q;
  q.in = () => q;
  q.order = () => q;
  q.limit = () => q;
  q.maybeSingle = async () => value;
  q.single = async () => value;
  q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(value).then(resolve, reject);
  return q;
}

function makeSupabase({
  prior = [] as { channel: string; status: string }[],
  updateError = null as { message: string } | null,
} = {}) {
  const updates: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      if (table === "posts") {
        return thenable({ data: prior, error: null });
      }
      if (table === "scheduled_posts") {
        return {
          update: (patch: Record<string, unknown>) => {
            updates.push(patch);
            return thenable({ data: [{ id: "row-1" }], error: updateError });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: vi.fn(),
  };
  return { client: client as unknown as SupabaseClient, updates };
}

const PAYLOAD: MultiPublishInput = {
  channels: ["linkedin", "threads"],
  body: "예약 본문",
  instagramCards: [],
};

function makeRow(overrides: Partial<ScheduledPostRow> = {}): ScheduledPostRow {
  return {
    id: "row-1",
    user_id: "user-1",
    scheduled_at: "2026-11-24T00:00:00.000Z",
    status: "processing",
    attempts: 1,
    max_attempts: 3,
    payload: PAYLOAD,
    batch_id: "batch-1",
    results: null,
    error_message: null,
    last_attempt_at: "2026-11-24T00:00:00.000Z",
    published_at: null,
    created_at: "2026-11-23T00:00:00.000Z",
    updated_at: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

// ─── 예약 시각 검증 ─────────────────────────────────────────────────────────

describe("parseScheduledAt", () => {
  const now = new Date("2026-11-23T12:00:00.000Z");

  it("rejects empty value", () => {
    const r = parseScheduledAt("", now);
    expect(r.ok).toBe(false);
  });

  it("rejects invalid format", () => {
    const r = parseScheduledAt("내일 아침", now);
    expect(r.ok).toBe(false);
  });

  it("rejects a time in the past", () => {
    const r = parseScheduledAt("2026-11-23T11:59:00.000Z", now);
    expect(r.ok).toBe(false);
  });

  it("rejects a time further than a year", () => {
    const r = parseScheduledAt("2028-01-01T00:00:00.000Z", now);
    expect(r.ok).toBe(false);
  });

  it("accepts a future time and normalizes to ISO", () => {
    const r = parseScheduledAt("2026-11-24T09:00:00+09:00", now);
    expect(r).toEqual({ ok: true, iso: "2026-11-24T00:00:00.000Z" });
  });
});

// ─── 발행 입력 검증 ─────────────────────────────────────────────────────────

describe("validateMultiPublishInput", () => {
  it("requires at least one channel", () => {
    expect(
      validateMultiPublishInput({ channels: [], body: "본문", instagramCards: [] })
    ).toMatch(/채널/);
  });

  it("accepts a valid multi-channel input", () => {
    expect(
      validateMultiPublishInput({
        channels: ["linkedin", "threads", "instagram", "reddit"],
        body: "본문",
        instagramCards: [{ title: "카드", description: "설명" }],
        reddit: { subreddit: "iosdev", title: "제목" },
      })
    ).toBeNull();
  });

  it("checks per-channel tailored content length", () => {
    expect(
      validateMultiPublishInput({
        channels: ["threads"],
        body: "본문",
        instagramCards: [],
        channelContents: { threads: "가".repeat(501) },
      })
    ).toMatch(/Threads/);
  });

  it("requires a subreddit and title for Reddit", () => {
    expect(
      validateMultiPublishInput({
        channels: ["reddit"],
        body: "본문",
        instagramCards: [],
        reddit: { subreddit: "", title: "제목" },
      })
    ).toMatch(/서브레딧/);

    expect(
      validateMultiPublishInput({
        channels: ["reddit"],
        body: "본문",
        instagramCards: [],
        reddit: { subreddit: "iosdev", title: "" },
      })
    ).toMatch(/제목/);
  });

  it("allows a Reddit link post without a body", () => {
    expect(
      validateMultiPublishInput({
        channels: ["reddit"],
        body: "",
        instagramCards: [],
        reddit: { subreddit: "iosdev", title: "제목", link: "https://a.dev" },
      })
    ).toBeNull();
  });

  it("limits Instagram cards to 10", () => {
    expect(
      validateMultiPublishInput({
        channels: ["instagram"],
        body: "캡션",
        instagramCards: Array.from({ length: 11 }, () => ({
          title: "",
          description: "",
        })),
      })
    ).toMatch(/10장/);
  });
});

// ─── payload 직렬화 ─────────────────────────────────────────────────────────

describe("parseScheduledPayload", () => {
  it("round-trips a stored payload", () => {
    const parsed = parseScheduledPayload({
      ...PAYLOAD,
      reddit: { subreddit: "iosdev", title: "제목", link: "", flairId: "f1" },
      channelContents: { threads: "스레드 본문", unknown: "무시" },
    });
    expect(parsed?.channels).toEqual(["linkedin", "threads"]);
    expect(parsed?.body).toBe("예약 본문");
    expect(parsed?.reddit?.title).toBe("제목");
    expect(parsed?.channelContents).toEqual({ threads: "스레드 본문" });
  });

  it("returns null for a broken payload", () => {
    expect(parseScheduledPayload(null)).toBeNull();
    expect(parseScheduledPayload({ channels: [] })).toBeNull();
  });

  it("builds a view for the history screen", () => {
    const view = toScheduledPostView(makeRow());
    expect(view.channels).toEqual(["linkedin", "threads"]);
    expect(view.body).toBe("예약 본문");
    expect(view.status).toBe("processing");
  });
});

// ─── cron 인증 ──────────────────────────────────────────────────────────────

describe("isAuthorizedCron", () => {
  function req(headers: Record<string, string>) {
    return new Request("http://localhost/api/cron/publish", { headers });
  }

  it("rejects everything when the secret is not configured", () => {
    expect(isAuthorizedCron(req({ authorization: "Bearer x" }), "")).toBe(false);
  });

  it("accepts the bearer token", () => {
    expect(
      isAuthorizedCron(req({ authorization: "Bearer s3cret" }), "s3cret")
    ).toBe(true);
  });

  it("accepts the x-cron-secret header", () => {
    expect(isAuthorizedCron(req({ "x-cron-secret": "s3cret" }), "s3cret")).toBe(
      true
    );
  });

  it("rejects a wrong or missing token", () => {
    expect(isAuthorizedCron(req({ authorization: "Bearer nope" }), "s3cret")).toBe(
      false
    );
    expect(isAuthorizedCron(req({}), "s3cret")).toBe(false);
  });
});

// ─── 예약 1건 발행 ──────────────────────────────────────────────────────────

describe("publishScheduledPost", () => {
  it("marks the row published when every channel succeeds", async () => {
    const { client, updates } = makeSupabase();
    publishMultiMock.mockResolvedValue({
      batchId: "batch-1",
      results: [
        { channel: "linkedin", success: true, externalId: "urn:1" },
        { channel: "threads", success: true, externalId: "th-1" },
      ],
    });

    const result = await publishScheduledPost({
      supabase: client,
      row: makeRow(),
      now: new Date("2026-11-24T00:00:05.000Z"),
    });

    expect(result.status).toBe("published");
    expect(updates[0].status).toBe("published");
    expect(updates[0].published_at).toBe("2026-11-24T00:00:05.000Z");
    expect(updates[0].error_message).toBeNull();
    // 예약 시점에 만든 batch_id 를 그대로 넘겨 posts 묶음을 유지한다.
    expect(publishMultiMock.mock.calls[0][0].batchId).toBe("batch-1");
  });

  it("skips channels already published in a previous attempt", async () => {
    const { client } = makeSupabase({
      prior: [{ channel: "linkedin", status: "success" }],
    });
    publishMultiMock.mockResolvedValue({
      batchId: "batch-1",
      results: [{ channel: "threads", success: true, externalId: "th-1" }],
    });

    const result = await publishScheduledPost({
      supabase: client,
      row: makeRow({ attempts: 2 }),
    });

    expect(publishMultiMock.mock.calls[0][0].input.channels).toEqual(["threads"]);
    expect(result.status).toBe("published");
    expect(result.results.map((r) => r.channel)).toEqual([
      "linkedin",
      "threads",
    ]);
  });

  it("does not retry when some channels already succeeded", async () => {
    const { client, updates } = makeSupabase({
      prior: [{ channel: "linkedin", status: "success" }],
    });
    publishMultiMock.mockResolvedValue({
      batchId: "batch-1",
      results: [{ channel: "threads", success: false, error: "토큰 만료" }],
    });

    const result = await publishScheduledPost({
      supabase: client,
      row: makeRow({ attempts: 1 }),
    });

    expect(result.status).toBe("failed");
    expect(updates[0].status).toBe("failed");
    expect(String(updates[0].error_message)).toMatch(/일부 채널 발행 실패/);
  });

  it("schedules a retry while attempts remain", async () => {
    const { client, updates } = makeSupabase();
    publishMultiMock.mockResolvedValue({
      batchId: "batch-1",
      results: [
        { channel: "linkedin", success: false, error: "네트워크" },
        { channel: "threads", success: false, error: "네트워크" },
      ],
    });

    const result = await publishScheduledPost({
      supabase: client,
      row: makeRow({ attempts: 1, max_attempts: 3 }),
    });

    expect(result.status).toBe("retry");
    expect(updates[0].status).toBe("scheduled");
  });

  it("gives up after the last attempt", async () => {
    const { client, updates } = makeSupabase();
    publishMultiMock.mockResolvedValue({
      batchId: "batch-1",
      results: [{ channel: "linkedin", success: false, error: "실패" }],
    });

    const result = await publishScheduledPost({
      supabase: client,
      row: makeRow({ attempts: 3, max_attempts: 3 }),
    });

    expect(result.status).toBe("failed");
    expect(updates[0].status).toBe("failed");
  });

  it("fails fast on a broken payload without publishing", async () => {
    const { client, updates } = makeSupabase();
    const result = await publishScheduledPost({
      supabase: client,
      row: makeRow({ payload: { channels: [] } }),
    });

    expect(result.status).toBe("failed");
    expect(publishMultiMock).not.toHaveBeenCalled();
    expect(String(updates[0].error_message)).toMatch(/예약 내용/);
  });

  it("refreshes expiring tokens before publishing", async () => {
    const { client } = makeSupabase();
    publishMultiMock.mockResolvedValue({
      batchId: "batch-1",
      results: [{ channel: "linkedin", success: true }],
    });

    await publishScheduledPost({ supabase: client, row: makeRow() });

    expect(ensureFreshMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", channels: ["linkedin", "threads"] })
    );
  });
});

// ─── cron 실행 ──────────────────────────────────────────────────────────────

describe("runPublishCron", () => {
  it("claims due rows and tallies outcomes", async () => {
    const rows = [
      makeRow({ id: "a", payload: { ...PAYLOAD, body: "ok" } }),
      makeRow({ id: "b", payload: { ...PAYLOAD, body: "fail" } }),
      makeRow({ id: "c", payload: { channels: [] } }),
    ];
    const rpc = vi.fn().mockResolvedValue({ data: rows, error: null });
    const updates: Record<string, unknown>[] = [];
    const from = (table: string) => {
      if (table === "posts") return thenable({ data: [], error: null });
      if (table === "scheduled_posts") {
        return {
          update: (patch: Record<string, unknown>) => {
            updates.push(patch);
            return thenable({ data: [{ id: "x" }], error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    };
    const supabase = { rpc, from } as unknown as SupabaseClient;

    publishMultiMock.mockImplementation(
      async ({ input }: { input: MultiPublishInput }) =>
        input.body === "ok"
          ? {
              batchId: "batch-1",
              results: [
                { channel: "linkedin", success: true },
                { channel: "threads", success: true },
              ],
            }
          : {
              batchId: "batch-1",
              results: [
                { channel: "linkedin", success: false, error: "실패" },
                { channel: "threads", success: false, error: "실패" },
              ],
            }
    );

    const summary = await runPublishCron({ supabase, limit: 3 });

    expect(rpc).toHaveBeenCalledWith("claim_due_scheduled_posts", { p_limit: 3 });
    expect(summary.claimed).toBe(3);
    expect(summary.published).toBe(1);
    expect(summary.retrying).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toHaveLength(2);
  });

  it("reports a claim failure without throwing", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function not found" },
    });
    const supabase = { rpc } as unknown as SupabaseClient;

    const summary = await runPublishCron({ supabase });

    expect(summary.claimed).toBe(0);
    expect(summary.errors[0]).toMatch(/함수|function|픽업/);
  });
});
