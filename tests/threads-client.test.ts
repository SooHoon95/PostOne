import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Threads publish client", () => {
  it("performs container create + publish 2-step", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "container_123" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "media_456" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { publishPost } = await import("@/lib/threads/client");
    const result = await publishPost({
      accessToken: "tok",
      userId: "u1",
      text: "Hello Threads",
    });

    expect(result.mediaId).toBe("media_456");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [containerUrl, containerInit] = fetchMock.mock.calls[0];
    expect(String(containerUrl)).toContain("/v1.0/u1/threads");
    expect(String(containerUrl)).toContain("media_type=TEXT");
    expect(String(containerUrl)).toContain("text=Hello+Threads");
    expect(containerInit.method).toBe("POST");

    const [publishUrl] = fetchMock.mock.calls[1];
    expect(String(publishUrl)).toContain("/v1.0/u1/threads_publish");
    expect(String(publishUrl)).toContain("creation_id=container_123");
  });

  it("throws on empty text", async () => {
    const { publishPost } = await import("@/lib/threads/client");
    await expect(
      publishPost({ accessToken: "tok", userId: "u1", text: "  " })
    ).rejects.toThrow(/empty/);
  });

  it("throws on text exceeding 500 chars", async () => {
    const { publishPost } = await import("@/lib/threads/client");
    await expect(
      publishPost({
        accessToken: "tok",
        userId: "u1",
        text: "x".repeat(501),
      })
    ).rejects.toThrow(/500/);
  });

  it("throws on container create failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "invalid_token",
      })
    );
    const { publishPost } = await import("@/lib/threads/client");
    await expect(
      publishPost({ accessToken: "tok", userId: "u1", text: "hello" })
    ).rejects.toThrow(/401/);
  });
});
