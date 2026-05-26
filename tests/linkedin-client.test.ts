import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("LinkedIn publish client", () => {
  it("publishPost POSTs to /rest/posts with correct headers and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "x-restli-id": "urn:li:share:1234567890" }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { publishPost } = await import("@/lib/linkedin/client");
    const result = await publishPost({
      accessToken: "tok",
      authorSub: "abc",
      commentary: "Hello world",
    });

    expect(result.urn).toBe("urn:li:share:1234567890");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.linkedin.com/rest/posts");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["LinkedIn-Version"]).toBe("202405");
    expect(init.headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
    const body = JSON.parse(init.body);
    expect(body.author).toBe("urn:li:person:abc");
    expect(body.commentary).toBe("Hello world");
    expect(body.lifecycleState).toBe("PUBLISHED");
    expect(body.visibility).toBe("PUBLIC");
  });

  it("publishPost throws on non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () => "invalid token",
      })
    );
    const { publishPost } = await import("@/lib/linkedin/client");
    await expect(
      publishPost({ accessToken: "x", authorSub: "y", commentary: "z" })
    ).rejects.toThrow(/401/);
  });
});
