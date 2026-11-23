import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getUserMock = vi.fn();
const insertMock = vi.fn();
const revalidateMock = vi.fn();
const runPublishMock = vi.fn();
const runRefreshMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "scheduled_posts") {
        return { insert: insertMock };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/auth/get-user", () => ({ requireUser: getUserMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: vi.fn() }),
}));

vi.mock("@/lib/scheduling/cron", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scheduling/cron")>();
  return {
    ...actual,
    runPublishCron: runPublishMock,
    runTokenRefreshCron: runRefreshMock,
  };
});

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ id: "user-1" });
  insertMock.mockReset().mockImplementation(() => ({
    select: () => ({
      single: async () => ({
        data: { id: "sched-1", scheduled_at: "2026-11-24T00:00:00.000Z" },
        error: null,
      }),
    }),
  }));
  revalidateMock.mockReset();
  runPublishMock.mockReset().mockResolvedValue({
    claimed: 1,
    published: 1,
    failed: 0,
    retrying: 0,
    saveFailed: 0,
    errors: [],
  });
  runRefreshMock.mockReset().mockResolvedValue({
    scanned: 0,
    refreshed: 0,
    failed: 0,
    errors: [],
  });
  process.env.CRON_SECRET = "test-secret";
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

const future = () =>
  new Date(Date.now() + 60 * 60 * 1000).toISOString();

const validInput = () => ({
  channels: ["linkedin", "threads"] as ("linkedin" | "threads")[],
  body: "예약 본문",
  instagramCards: [],
  channelContents: { threads: "스레드 맞춤 본문" },
});

describe("schedulePost action", () => {
  it("rejects a past time before touching the DB", async () => {
    const { schedulePost } = await import("@/app/(app)/compose/actions");
    const result = await schedulePost({
      ...validInput(),
      scheduledAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/지금 이후/);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid publish input", async () => {
    const { schedulePost } = await import("@/app/(app)/compose/actions");
    const result = await schedulePost({
      channels: [],
      body: "본문",
      instagramCards: [],
      scheduledAt: future(),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/채널/);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("stores the whole publish payload on the scheduled row", async () => {
    const { schedulePost } = await import("@/app/(app)/compose/actions");
    const at = future();
    const result = await schedulePost({ ...validInput(), scheduledAt: at });

    expect(result).toEqual({
      ok: true,
      id: "sched-1",
      scheduledAt: "2026-11-24T00:00:00.000Z",
    });

    const row = insertMock.mock.calls[0][0];
    expect(row.user_id).toBe("user-1");
    expect(row.status).toBe("scheduled");
    expect(row.scheduled_at).toBe(at);
    expect(row.payload.channels).toEqual(["linkedin", "threads"]);
    expect(row.payload.channelContents).toEqual({ threads: "스레드 맞춤 본문" });
    expect(revalidateMock).toHaveBeenCalledWith("/history");
  });

  it("surfaces a DB failure as a readable error", async () => {
    insertMock.mockImplementation(() => ({
      select: () => ({
        single: async () => ({ data: null, error: { message: "boom" } }),
      }),
    }));
    const { schedulePost } = await import("@/app/(app)/compose/actions");
    const result = await schedulePost({
      ...validInput(),
      scheduledAt: future(),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/예약 등록에 실패/);
  });
});

describe("cron routes", () => {
  function call(url: string, headers: Record<string, string> = {}) {
    return new Request(`http://localhost${url}`, { headers });
  }

  it("rejects an unauthenticated publish request", async () => {
    const { GET } = await import("@/app/api/cron/publish/route");
    const res = await GET(call("/api/cron/publish"));
    expect(res.status).toBe(401);
    expect(runPublishMock).not.toHaveBeenCalled();
  });

  it("runs the publish cron with the bearer secret", async () => {
    const { GET } = await import("@/app/api/cron/publish/route");
    const res = await GET(
      call("/api/cron/publish", { authorization: "Bearer test-secret" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.published).toBe(1);
    expect(revalidateMock).toHaveBeenCalledWith("/history");
  });

  it("refuses to run when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/publish/route");
    const res = await GET(call("/api/cron/publish"));
    expect(res.status).toBe(503);
    expect(runPublishMock).not.toHaveBeenCalled();
  });

  it("guards the token refresh route the same way", async () => {
    const { POST } = await import("@/app/api/cron/refresh-tokens/route");
    const denied = await POST(call("/api/cron/refresh-tokens"));
    expect(denied.status).toBe(401);

    const res = await POST(
      call("/api/cron/refresh-tokens", { "x-cron-secret": "test-secret" })
    );
    expect(res.status).toBe(200);
    expect(runRefreshMock).toHaveBeenCalled();
  });
});
