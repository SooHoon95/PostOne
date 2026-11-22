import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Reddit submit client", () => {
  it("posts a self text with api_type=json and kind=self", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        json: {
          errors: [],
          data: {
            id: "abc123",
            name: "t3_abc123",
            url: "https://www.reddit.com/r/iosdev/comments/abc123/x/",
            permalink: "/r/iosdev/comments/abc123/x/",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { submitPost } = await import("@/lib/reddit/client");
    const r = await submitPost({
      accessToken: "tok",
      subreddit: "r/iosdev",
      title: "사이드 프로젝트 후기",
      body: "본문입니다",
    });

    expect(r.fullname).toBe("t3_abc123");
    expect(r.permalink).toBe("https://www.reddit.com/r/iosdev/comments/abc123/x/");

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://oauth.reddit.com/api/submit");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["User-Agent"]).toBeTruthy();

    const form = new URLSearchParams(init.body);
    expect(form.get("api_type")).toBe("json");
    expect(form.get("kind")).toBe("self");
    expect(form.get("sr")).toBe("iosdev"); // r/ 접두사 제거
    expect(form.get("title")).toBe("사이드 프로젝트 후기");
    expect(form.get("text")).toBe("본문입니다");
    expect(form.get("url")).toBeNull();
  });

  it("posts a link kind when url is given and sends flair_id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        json: { errors: [], data: { id: "l1", name: "t3_l1" } },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { submitPost } = await import("@/lib/reddit/client");
    const r = await submitPost({
      accessToken: "tok",
      subreddit: "iosdev",
      title: "링크 공유",
      body: "무시되는 본문",
      url: "https://example.com/post",
      flairId: "flair-uuid",
    });

    expect(r.permalink).toBeNull();
    const form = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(form.get("kind")).toBe("link");
    expect(form.get("url")).toBe("https://example.com/post");
    expect(form.get("text")).toBeNull();
    expect(form.get("flair_id")).toBe("flair-uuid");
  });

  it("throws on Reddit json.errors returned with HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          json: {
            errors: [["SUBREDDIT_NOTALLOWED", "that community doesn't allow posts", "sr"]],
          },
        }),
      })
    );
    const { submitPost } = await import("@/lib/reddit/client");
    await expect(
      submitPost({ accessToken: "tok", subreddit: "foo", title: "t", body: "b" })
    ).rejects.toThrow(/SUBREDDIT_NOTALLOWED/);
  });

  it("validates title, body and subreddit before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { submitPost } = await import("@/lib/reddit/client");

    await expect(
      submitPost({ accessToken: "tok", subreddit: "foo", title: "  ", body: "b" })
    ).rejects.toThrow(/title is required/);

    await expect(
      submitPost({ accessToken: "tok", subreddit: "foo", title: "t", body: "" })
    ).rejects.toThrow(/text or link/);

    await expect(
      submitPost({ accessToken: "tok", subreddit: "a!", title: "t", body: "b" })
    ).rejects.toThrow(/subreddit/);

    await expect(
      submitPost({
        accessToken: "tok",
        subreddit: "foo",
        title: "t".repeat(301),
        body: "b",
      })
    ).rejects.toThrow(/300/);

    await expect(
      submitPost({
        accessToken: "tok",
        subreddit: "foo",
        title: "t",
        url: "ftp://example.com",
      })
    ).rejects.toThrow(/http/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on non-OK HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "forbidden",
      })
    );
    const { submitPost } = await import("@/lib/reddit/client");
    await expect(
      submitPost({ accessToken: "tok", subreddit: "foo", title: "t", body: "b" })
    ).rejects.toThrow(/403/);
  });
});

describe("Reddit flair helper", () => {
  it("fetches link flairs for a subreddit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "f1", text: "Discussion", text_editable: false },
        { id: "f2", text: "Showcase", text_editable: true },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getSubredditFlairs } = await import("@/lib/reddit/client");
    const flairs = await getSubredditFlairs({
      accessToken: "tok",
      subreddit: "/r/iosdev",
    });

    expect(flairs.map((f) => f.text)).toEqual(["Discussion", "Showcase"]);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      "https://oauth.reddit.com/r/iosdev/api/link_flair_v2"
    );
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("returns empty list when subreddit has no flairs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => null })
    );
    const { getSubredditFlairs } = await import("@/lib/reddit/client");
    const flairs = await getSubredditFlairs({
      accessToken: "tok",
      subreddit: "iosdev",
    });
    expect(flairs).toEqual([]);
  });

  it("normalizes subreddit input", async () => {
    const { normalizeSubreddit, isValidSubreddit } = await import(
      "@/lib/reddit/subreddit"
    );
    expect(normalizeSubreddit("r/iosdev")).toBe("iosdev");
    expect(normalizeSubreddit("/r/iosdev ")).toBe("iosdev");
    expect(normalizeSubreddit(" iosdev ")).toBe("iosdev");
    expect(isValidSubreddit("iosdev")).toBe(true);
    expect(isValidSubreddit("r/u_apple_dev")).toBe(true);
    expect(isValidSubreddit("a")).toBe(false);
    expect(isValidSubreddit("bad-name!")).toBe(false);
  });
});
