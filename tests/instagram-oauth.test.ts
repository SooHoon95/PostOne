import { describe, it, expect, vi, beforeEach } from "vitest";

const ENV = {
  INSTAGRAM_APP_ID: "fb_app_id",
  INSTAGRAM_APP_SECRET: "fb_app_secret",
  INSTAGRAM_REDIRECT_URI: "http://localhost:3000/api/instagram/oauth/callback",
};

beforeEach(() => {
  Object.assign(process.env, ENV);
  vi.restoreAllMocks();
});

describe("Instagram(FB) OAuth", () => {
  it("buildAuthUrl includes required params", async () => {
    const { buildAuthUrl } = await import("@/lib/instagram/oauth");
    const url = new URL(buildAuthUrl("st"));
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toContain("/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe(ENV.INSTAGRAM_APP_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(ENV.INSTAGRAM_REDIRECT_URI);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("st");
    const scope = url.searchParams.get("scope")!;
    expect(scope).toContain("instagram_basic");
    expect(scope).toContain("instagram_content_publish");
    expect(scope).toContain("pages_show_list");
  });

  it("exchangeCodeForToken hits token endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "short",
        token_type: "bearer",
        expires_in: 3600,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { exchangeCodeForToken } = await import("@/lib/instagram/oauth");
    const r = await exchangeCodeForToken("c1");
    expect(r.access_token).toBe("short");
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("graph.facebook.com");
    expect(String(calledUrl)).toContain("oauth/access_token");
    expect(String(calledUrl)).toContain("code=c1");
  });

  it("exchangeForLongLivedToken uses fb_exchange_token grant", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "long",
        token_type: "bearer",
        expires_in: 5184000,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { exchangeForLongLivedToken } = await import(
      "@/lib/instagram/oauth"
    );
    const r = await exchangeForLongLivedToken("short");
    expect(r.access_token).toBe("long");
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("grant_type=fb_exchange_token");
  });

  it("findInstagramBusinessAccount finds page with IG account", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "page_1", name: "No IG", access_token: "pat_1" },
            {
              id: "page_2",
              name: "Has IG",
              access_token: "pat_2",
              instagram_business_account: { id: "ig_42" },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ username: "kim_ig" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { findInstagramBusinessAccount } = await import(
      "@/lib/instagram/oauth"
    );
    const info = await findInstagramBusinessAccount("user_tok");
    expect(info.igUserId).toBe("ig_42");
    expect(info.pageId).toBe("page_2");
    expect(info.pageAccessToken).toBe("pat_2");
    expect(info.username).toBe("kim_ig");
  });

  it("findInstagramBusinessAccount throws when no IG-linked page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "p1", name: "no IG", access_token: "x" }],
        }),
      })
    );
    const { findInstagramBusinessAccount } = await import(
      "@/lib/instagram/oauth"
    );
    await expect(findInstagramBusinessAccount("tok")).rejects.toThrow(
      /Business/
    );
  });
});
