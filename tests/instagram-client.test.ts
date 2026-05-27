import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Instagram publish client (new API, 2024+)", () => {
  it("publishSingle creates container + publishes via graph.instagram.com", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "container_1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "media_99" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { publishSingle } = await import("@/lib/instagram/client");
    const result = await publishSingle({
      accessToken: "tok",
      igUserId: "ig_42",
      imageUrl: "https://cdn/x.png",
      caption: "Hi",
    });

    expect(result.mediaId).toBe("media_99");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [containerUrl] = fetchMock.mock.calls[0];
    expect(String(containerUrl)).toContain("graph.instagram.com/v21.0/ig_42/media");
    expect(String(containerUrl)).toContain("image_url=https");
    const [publishUrl] = fetchMock.mock.calls[1];
    expect(String(publishUrl)).toContain(
      "graph.instagram.com/v21.0/ig_42/media_publish"
    );
    expect(String(publishUrl)).toContain("creation_id=container_1");
  });

  it("publishCarousel creates N child + 1 parent + publishes", async () => {
    const fetchMock = vi.fn();
    // 3 children
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c1" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c2" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c3" }),
    });
    // 1 parent
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "parent" }),
    });
    // publish
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "media_xx" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { publishCarousel } = await import("@/lib/instagram/client");
    const result = await publishCarousel({
      accessToken: "tok",
      igUserId: "ig_42",
      imageUrls: ["a", "b", "c"],
      caption: "Carousel",
    });

    expect(result.mediaId).toBe("media_xx");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const [parentUrl] = fetchMock.mock.calls[3];
    expect(String(parentUrl)).toContain("media_type=CAROUSEL");
    expect(String(parentUrl)).toContain("children=c1%2Cc2%2Cc3");
  });

  it("publishCarousel throws on < 2 images", async () => {
    const { publishCarousel } = await import("@/lib/instagram/client");
    await expect(
      publishCarousel({
        accessToken: "t",
        igUserId: "i",
        imageUrls: ["a"],
        caption: "c",
      })
    ).rejects.toThrow(/2~10/);
  });

  it("publishCarousel throws on > 10 images", async () => {
    const { publishCarousel } = await import("@/lib/instagram/client");
    await expect(
      publishCarousel({
        accessToken: "t",
        igUserId: "i",
        imageUrls: Array(11).fill("x"),
        caption: "c",
      })
    ).rejects.toThrow(/2~10/);
  });

  it("publishSingle throws on caption too long", async () => {
    const { publishSingle } = await import("@/lib/instagram/client");
    await expect(
      publishSingle({
        accessToken: "t",
        igUserId: "i",
        imageUrl: "u",
        caption: "x".repeat(2201),
      })
    ).rejects.toThrow(/2200/);
  });
});
