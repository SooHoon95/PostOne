import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const insertPostMock = vi.fn();
const linkedinPublishMock = vi.fn();
const threadsPublishMock = vi.fn();
const instagramPublishSingleMock = vi.fn();
const redditSubmitMock = vi.fn();
const renderSlidesMock = vi.fn();
const uploadCardsMock = vi.fn();

const CONNECTIONS: Record<string, Record<string, string>> = {
  linkedin_connections: {
    linkedin_sub: "li-sub",
    access_token_ciphertext: "ct",
    access_token_iv: "iv",
    access_token_tag: "tag",
  },
  threads_connections: {
    threads_user_id: "threads-user",
    access_token_ciphertext: "ct",
    access_token_iv: "iv",
    access_token_tag: "tag",
  },
  instagram_connections: {
    instagram_business_id: "ig-user",
    access_token_ciphertext: "ct",
    access_token_iv: "iv",
    access_token_tag: "tag",
  },
  reddit_connections: { id: "reddit-conn" },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "posts") return { insert: insertPostMock };
      const row = CONNECTIONS[table];
      if (!row) throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }),
      };
    },
  }),
}));

vi.mock("@/lib/auth/get-user", () => ({ requireUser: getUserMock }));
vi.mock("@/lib/crypto/encrypt", () => ({
  decryptToken: () => "decrypted_access_token",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/linkedin/client", () => ({ publishPost: linkedinPublishMock }));
vi.mock("@/lib/threads/client", () => ({ publishPost: threadsPublishMock }));
vi.mock("@/lib/instagram/client", () => ({
  publishSingle: instagramPublishSingleMock,
  publishCarousel: vi.fn(),
}));
vi.mock("@/lib/cards/generator", () => ({
  renderSlidesToImages: renderSlidesMock,
}));
vi.mock("@/lib/cards/upload", () => ({
  uploadCardImages: uploadCardsMock,
  createBackgroundUploadUrl: vi.fn(),
  BACKGROUND_ALLOWED_EXTS: ["jpg", "png", "webp"],
}));
vi.mock("@/lib/reddit/client", () => ({
  isValidSubreddit: () => true,
  normalizeSubreddit: (value: string) => value.replace(/^\/?r\//i, ""),
  submitPost: redditSubmitMock,
  REDDIT_TITLE_MAX: 300,
}));
vi.mock("@/lib/reddit/session", () => ({
  REDDIT_CONNECTION_COLUMNS: "id",
  resolveRedditToken: async () => ({ accessToken: "reddit-token" }),
}));

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ id: "user-1" });
  insertPostMock.mockReset().mockImplementation(() => ({
    error: null,
    select: () => ({ single: async () => ({ data: {}, error: null }) }),
  }));
  linkedinPublishMock
    .mockReset()
    .mockResolvedValue({ urn: "urn:li:share:1" });
  threadsPublishMock.mockReset().mockResolvedValue({ mediaId: "threads-1" });
  instagramPublishSingleMock
    .mockReset()
    .mockResolvedValue({ mediaId: "ig-1" });
  redditSubmitMock.mockReset().mockResolvedValue({
    id: "abc",
    fullname: "t3_abc",
    url: null,
    permalink: "https://www.reddit.com/r/iosdev/comments/abc/x/",
  });
  renderSlidesMock.mockReset().mockResolvedValue([Buffer.from("card")]);
  uploadCardsMock
    .mockReset()
    .mockResolvedValue(["https://cdn.example.com/1.jpg"]);
});

const baseInput = {
  channels: ["linkedin", "threads", "instagram", "reddit"] as const,
  body: "공통 본문",
  instagramCards: [{ title: "카드", description: "설명" }],
  reddit: { subreddit: "iosdev", title: "공통 제목" },
};

describe("publishMulti — channelContents", () => {
  it("sends each channel its tailored content", async () => {
    const { publishMulti } = await import("@/app/(app)/compose/actions");

    const { results } = await publishMulti({
      ...baseInput,
      channels: [...baseInput.channels],
      channelContents: {
        linkedin: "링크드인 맞춤 본문",
        threads: "스레드 맞춤 본문",
        instagram: "인스타 맞춤 캡션",
        reddit: "레딧 맞춤 본문",
      },
    });

    expect(results.every((r) => r.success)).toBe(true);
    expect(linkedinPublishMock).toHaveBeenCalledWith(
      expect.objectContaining({ commentary: "링크드인 맞춤 본문" })
    );
    expect(threadsPublishMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "스레드 맞춤 본문" })
    );
    expect(instagramPublishSingleMock).toHaveBeenCalledWith(
      expect.objectContaining({ caption: "인스타 맞춤 캡션" })
    );
    expect(redditSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: "레딧 맞춤 본문", title: "공통 제목" })
    );

    const instagramRow = insertPostMock.mock.calls
      .map((call) => call[0])
      .find((row) => row.channel === "instagram");
    expect(instagramRow.content).toBe("인스타 맞춤 캡션");
  });

  it("falls back to the shared body when no overrides exist (backward compatible)", async () => {
    const { publishMulti } = await import("@/app/(app)/compose/actions");

    await publishMulti({ ...baseInput, channels: [...baseInput.channels] });

    expect(linkedinPublishMock).toHaveBeenCalledWith(
      expect.objectContaining({ commentary: "공통 본문" })
    );
    expect(threadsPublishMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "공통 본문" })
    );
    expect(instagramPublishSingleMock).toHaveBeenCalledWith(
      expect.objectContaining({ caption: "공통 본문" })
    );
    expect(redditSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: "공통 본문" })
    );
  });

  it("mixes overrides and fallback per channel", async () => {
    const { publishMulti } = await import("@/app/(app)/compose/actions");

    await publishMulti({
      ...baseInput,
      channels: ["linkedin", "threads"],
      channelContents: { threads: "  스레드만 맞춤  ", linkedin: "   " },
    });

    expect(linkedinPublishMock).toHaveBeenCalledWith(
      expect.objectContaining({ commentary: "공통 본문" })
    );
    expect(threadsPublishMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "스레드만 맞춤" })
    );
  });
});
