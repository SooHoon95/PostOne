import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const selectConnectionMock = vi.fn();
const insertPostMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "reddit_connections") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: selectConnectionMock }),
          }),
        };
      }
      if (table === "posts") {
        return { insert: insertPostMock };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/auth/get-user", () => ({
  requireUser: getUserMock,
}));

vi.mock("@/lib/reddit/session", () => ({
  REDDIT_CONNECTION_COLUMNS: "access_token_ciphertext",
  resolveRedditToken: async () => ({
    accessToken: "decrypted_access_token",
    username: "iosdev_kim",
    refreshed: false,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

beforeEach(() => {
  getUserMock.mockReset();
  selectConnectionMock.mockReset();
  insertPostMock.mockReset();
  insertPostMock.mockResolvedValue({ error: null });
  vi.restoreAllMocks();
});

describe("publishToReddit action", () => {
  it("returns error when title is missing", async () => {
    const { publishToReddit } = await import("@/app/(app)/compose/actions");
    const r = await publishToReddit({
      content: "본문",
      subreddit: "iosdev",
      title: "   ",
    });
    expect(r.error).toMatch(/제목/);
  });

  it("returns error for an invalid subreddit name", async () => {
    const { publishToReddit } = await import("@/app/(app)/compose/actions");
    const r = await publishToReddit({
      content: "본문",
      subreddit: "bad name!",
      title: "제목",
    });
    expect(r.error).toMatch(/서브레딧/);
  });

  it("returns error when Reddit is not connected", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    selectConnectionMock.mockResolvedValue({ data: null });

    const { publishToReddit } = await import("@/app/(app)/compose/actions");
    const r = await publishToReddit({
      content: "본문",
      subreddit: "iosdev",
      title: "제목",
    });
    expect(r.error).toMatch(/연결되지 않았습니다/);
  });

  it("posts a link to Reddit and records the result", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    selectConnectionMock.mockResolvedValue({ data: { expires_at: "far" } });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        json: {
          errors: [],
          data: {
            id: "abc",
            name: "t3_abc",
            permalink: "/r/iosdev/comments/abc/x/",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { publishToReddit } = await import("@/app/(app)/compose/actions");
    const r = await publishToReddit({
      content: "",
      subreddit: "r/iosdev",
      title: "링크 공유",
      link: "https://example.com/article",
    });

    expect(r.error).toBeUndefined();
    expect(r.urn).toBe("t3_abc");
    expect(r.permalink).toBe("https://www.reddit.com/r/iosdev/comments/abc/x/");

    expect(fetchMock.mock.calls[0][0]).toBe("https://oauth.reddit.com/api/submit");

    const inserted = insertPostMock.mock.calls[0][0];
    expect(inserted.channel).toBe("reddit");
    expect(inserted.status).toBe("success");
    expect(inserted.subreddit).toBe("iosdev");
    expect(inserted.title).toBe("링크 공유");
    expect(inserted.content).toBe("https://example.com/article");
    expect(inserted.external_id).toBe("t3_abc");
  });

  it("records a failed post when Reddit rejects it", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    selectConnectionMock.mockResolvedValue({ data: { expires_at: "far" } });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          json: { errors: [["RATELIMIT", "you are doing that too much"]] },
        }),
      })
    );

    const { publishToReddit } = await import("@/app/(app)/compose/actions");
    const r = await publishToReddit({
      content: "본문",
      subreddit: "iosdev",
      title: "제목",
    });

    expect(r.error).toMatch(/RATELIMIT/);
    const inserted = insertPostMock.mock.calls[0][0];
    expect(inserted.status).toBe("failed");
    expect(inserted.error_message).toMatch(/RATELIMIT/);
  });
});
