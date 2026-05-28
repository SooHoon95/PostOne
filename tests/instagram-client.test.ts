import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Instagram publish client (new API, 2024+)", () => {
  it("publishSingle: create → wait FINISHED → publish", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "container_1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status_code: "FINISHED" }),
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [createUrl] = fetchMock.mock.calls[0];
    expect(String(createUrl)).toContain("graph.instagram.com/v21.0/ig_42/media");
    const [statusUrl] = fetchMock.mock.calls[1];
    expect(String(statusUrl)).toContain("graph.instagram.com/v21.0/container_1");
    expect(String(statusUrl)).toContain("fields=status_code");
    const [publishUrl] = fetchMock.mock.calls[2];
    expect(String(publishUrl)).toContain("media_publish");
  });

  it("publishCarousel: 3 children + wait + parent + wait + publish", async () => {
    let createCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("/media_publish")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "media_xx" }),
        });
      }
      if (u.includes("fields=status_code")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status_code: "FINISHED" }),
        });
      }
      if (u.includes("/media")) {
        // create container
        createCount += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: createCount <= 3 ? `c${createCount}` : "parent",
          }),
        });
      }
      return Promise.reject(new Error(`unexpected url: ${u}`));
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
  });

  it("publishSingle: throws when status becomes ERROR", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "container_1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status_code: "ERROR" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { publishSingle } = await import("@/lib/instagram/client");
    await expect(
      publishSingle({
        accessToken: "tok",
        igUserId: "i",
        imageUrl: "u",
        caption: "c",
      })
    ).rejects.toThrow(/ERROR/);
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
