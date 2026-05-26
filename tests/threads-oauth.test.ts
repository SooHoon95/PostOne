import { describe, it, expect, vi, beforeEach } from "vitest";

const ENV = {
  THREADS_CLIENT_ID: "th_client_id",
  THREADS_CLIENT_SECRET: "th_client_secret",
  THREADS_REDIRECT_URI: "http://localhost:3000/api/threads/oauth/callback",
};

beforeEach(() => {
  Object.assign(process.env, ENV);
  vi.restoreAllMocks();
});

describe("Threads OAuth", () => {
  it("buildAuthUrl includes required params", async () => {
    const { buildAuthUrl } = await import("@/lib/threads/oauth");
    const url = new URL(buildAuthUrl("state_x"));
    expect(url.origin).toBe("https://threads.net");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe(ENV.THREADS_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(ENV.THREADS_REDIRECT_URI);
    expect(url.searchParams.get("scope")).toBe(
      "threads_basic,threads_content_publish"
    );
    expect(url.searchParams.get("state")).toBe("state_x");
  });

  it("exchangeCodeForToken POSTs and returns token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "th_short", user_id: 42 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { exchangeCodeForToken } = await import("@/lib/threads/oauth");
    const r = await exchangeCodeForToken("code123");
    expect(r.access_token).toBe("th_short");
    expect(r.user_id).toBe(42);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://graph.threads.net/oauth/access_token");
    expect(init.method).toBe("POST");
  });

  it("exchangeForLongLivedToken hits long-lived endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "th_long",
        token_type: "bearer",
        expires_in: 5184000,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { exchangeForLongLivedToken } = await import("@/lib/threads/oauth");
    const r = await exchangeForLongLivedToken("short_token");
    expect(r.access_token).toBe("th_long");
    expect(r.expires_in).toBe(5184000);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("graph.threads.net/access_token");
    expect(String(calledUrl)).toContain("grant_type=th_exchange_token");
  });

  it("fetchUserInfo returns id and username", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "th_user_1", username: "kim" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { fetchUserInfo } = await import("@/lib/threads/oauth");
    const info = await fetchUserInfo("tok");
    expect(info.id).toBe("th_user_1");
    expect(info.username).toBe("kim");
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
    const { exchangeCodeForToken } = await import("@/lib/threads/oauth");
    await expect(exchangeCodeForToken("x")).rejects.toThrow(/400/);
  });
});
