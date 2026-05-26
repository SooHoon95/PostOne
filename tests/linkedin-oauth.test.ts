import { describe, it, expect, vi, beforeEach } from "vitest";

const ENV = {
  LINKEDIN_CLIENT_ID: "test_client_id",
  LINKEDIN_CLIENT_SECRET: "test_client_secret",
  LINKEDIN_REDIRECT_URI: "http://localhost:3000/api/linkedin/oauth/callback",
};

beforeEach(() => {
  Object.assign(process.env, ENV);
});

describe("LinkedIn OAuth", () => {
  it("buildAuthUrl includes required params", async () => {
    const { buildAuthUrl } = await import("@/lib/linkedin/oauth");
    const url = new URL(buildAuthUrl("state_abc"));

    expect(url.origin).toBe("https://www.linkedin.com");
    expect(url.pathname).toBe("/oauth/v2/authorization");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(ENV.LINKEDIN_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(ENV.LINKEDIN_REDIRECT_URI);
    expect(url.searchParams.get("scope")).toBe("openid profile w_member_social");
    expect(url.searchParams.get("state")).toBe("state_abc");
  });

  it("exchangeCodeForToken posts and returns token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "abc123",
        expires_in: 5184000,
        scope: "openid profile w_member_social",
        token_type: "Bearer",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { exchangeCodeForToken } = await import("@/lib/linkedin/oauth");
    const result = await exchangeCodeForToken("code_xyz");

    expect(result.access_token).toBe("abc123");
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe("https://www.linkedin.com/oauth/v2/accessToken");
    expect(callArgs[1].method).toBe("POST");
    const body = new URLSearchParams(callArgs[1].body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("code_xyz");
    expect(body.get("client_id")).toBe(ENV.LINKEDIN_CLIENT_ID);
    expect(body.get("client_secret")).toBe(ENV.LINKEDIN_CLIENT_SECRET);
  });

  it("exchangeCodeForToken throws on non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "invalid_grant",
      })
    );
    const { exchangeCodeForToken } = await import("@/lib/linkedin/oauth");
    await expect(exchangeCodeForToken("bad")).rejects.toThrow(/400/);
  });
});
