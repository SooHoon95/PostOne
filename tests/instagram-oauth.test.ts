import { describe, it, expect, vi, beforeEach } from "vitest";

const ENV = {
  INSTAGRAM_APP_ID: "ig_app_id",
  INSTAGRAM_APP_SECRET: "ig_app_secret",
  INSTAGRAM_REDIRECT_URI: "http://localhost:3000/api/instagram/oauth/callback",
};

beforeEach(() => {
  Object.assign(process.env, ENV);
  vi.restoreAllMocks();
});

describe("Instagram OAuth (new API, 2024+)", () => {
  it("buildAuthUrl points at instagram.com with business scopes", async () => {
    const { buildAuthUrl } = await import("@/lib/instagram/oauth");
    const url = new URL(buildAuthUrl("st"));
    expect(url.origin).toBe("https://www.instagram.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe(ENV.INSTAGRAM_APP_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(ENV.INSTAGRAM_REDIRECT_URI);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("st");
    const scope = url.searchParams.get("scope")!;
    expect(scope).toContain("instagram_business_basic");
    expect(scope).toContain("instagram_business_content_publish");
  });

  it("exchangeCodeForToken POSTs to api.instagram.com", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "ig_short",
        user_id: 42,
        permissions: "instagram_business_basic",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { exchangeCodeForToken } = await import("@/lib/instagram/oauth");
    const r = await exchangeCodeForToken("c1");
    expect(r.access_token).toBe("ig_short");
    expect(r.user_id).toBe(42);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toBe(
      "https://api.instagram.com/oauth/access_token"
    );
    expect(init.method).toBe("POST");
  });

  it("exchangeForLongLivedToken uses ig_exchange_token grant", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "ig_long",
        token_type: "bearer",
        expires_in: 5184000,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { exchangeForLongLivedToken } = await import(
      "@/lib/instagram/oauth"
    );
    const r = await exchangeForLongLivedToken("short");
    expect(r.access_token).toBe("ig_long");
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("graph.instagram.com/access_token");
    expect(String(calledUrl)).toContain("grant_type=ig_exchange_token");
  });

  it("fetchUserInfo hits graph.instagram.com /me", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "app_scoped",
        user_id: "ig_42",
        username: "kim_ig",
        account_type: "BUSINESS",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { fetchUserInfo } = await import("@/lib/instagram/oauth");
    const info = await fetchUserInfo("tok");
    expect(info.user_id).toBe("ig_42");
    expect(info.username).toBe("kim_ig");
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("graph.instagram.com/v21.0/me");
  });

  it("exchangeCodeForToken throws on non-OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "bad_code",
      })
    );
    const { exchangeCodeForToken } = await import("@/lib/instagram/oauth");
    await expect(exchangeCodeForToken("x")).rejects.toThrow(/400/);
  });
});
