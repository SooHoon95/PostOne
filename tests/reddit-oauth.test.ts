import { describe, it, expect, vi, beforeEach } from "vitest";

const ENV = {
  REDDIT_CLIENT_ID: "rd_client_id",
  REDDIT_CLIENT_SECRET: "rd_client_secret",
  REDDIT_REDIRECT_URI: "http://localhost:3000/api/reddit/oauth/callback",
};

beforeEach(() => {
  Object.assign(process.env, ENV);
  vi.restoreAllMocks();
});

describe("Reddit OAuth", () => {
  it("buildAuthUrl includes permanent duration and submit scopes", async () => {
    const { buildAuthUrl } = await import("@/lib/reddit/oauth");
    const url = new URL(buildAuthUrl("state_x"));
    expect(url.origin).toBe("https://www.reddit.com");
    expect(url.pathname).toBe("/api/v1/authorize");
    expect(url.searchParams.get("client_id")).toBe(ENV.REDDIT_CLIENT_ID);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("duration")).toBe("permanent");
    expect(url.searchParams.get("scope")).toBe("identity,submit,read,flair");
    expect(url.searchParams.get("redirect_uri")).toBe(ENV.REDDIT_REDIRECT_URI);
    expect(url.searchParams.get("state")).toBe("state_x");
  });

  it("exchangeCodeForToken sends Basic auth and returns token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "rd_access",
        token_type: "bearer",
        expires_in: 86400,
        refresh_token: "rd_refresh",
        scope: "identity submit read flair",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { exchangeCodeForToken } = await import("@/lib/reddit/oauth");
    const r = await exchangeCodeForToken("code123");

    expect(r.access_token).toBe("rd_access");
    expect(r.refresh_token).toBe("rd_refresh");

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://www.reddit.com/api/v1/access_token");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("rd_client_id:rd_client_secret").toString("base64")}`
    );
    expect(init.headers["User-Agent"]).toBeTruthy();
    const body = new URLSearchParams(init.body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("code123");
    expect(body.get("redirect_uri")).toBe(ENV.REDDIT_REDIRECT_URI);
  });

  it("throws when token endpoint answers 200 with error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: "invalid_grant" }),
      })
    );
    const { exchangeCodeForToken } = await import("@/lib/reddit/oauth");
    await expect(exchangeCodeForToken("bad")).rejects.toThrow(/invalid_grant/);
  });

  it("refreshAccessToken uses grant_type=refresh_token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "rd_new",
        token_type: "bearer",
        expires_in: 86400,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { refreshAccessToken } = await import("@/lib/reddit/oauth");
    const r = await refreshAccessToken("rd_refresh");

    expect(r.accessToken).toBe("rd_new");
    expect(r.expiresIn).toBe(86400);
    expect(r.refreshToken).toBeNull();

    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(init.body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rd_refresh");
  });

  it("fetchUserInfo calls /api/v1/me with Bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "u1", name: "iosdev_kim" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchUserInfo } = await import("@/lib/reddit/oauth");
    const me = await fetchUserInfo("tok");

    expect(me.name).toBe("iosdev_kim");
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://oauth.reddit.com/api/v1/me");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("revokeToken posts token with hint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const { revokeToken } = await import("@/lib/reddit/oauth");
    await revokeToken("rd_refresh", "refresh_token");

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://www.reddit.com/api/v1/revoke_token");
    const body = new URLSearchParams(init.body);
    expect(body.get("token")).toBe("rd_refresh");
    expect(body.get("token_type_hint")).toBe("refresh_token");
  });

  it("isExpired compares expiry with skew", async () => {
    const { isExpired } = await import("@/lib/reddit/oauth");
    expect(isExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isExpired(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toBe(
      false
    );
    expect(isExpired("not-a-date")).toBe(true);
  });

  it("exchangeCodeForToken throws on non-OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      })
    );
    const { exchangeCodeForToken } = await import("@/lib/reddit/oauth");
    await expect(exchangeCodeForToken("x")).rejects.toThrow(/401/);
  });
});
