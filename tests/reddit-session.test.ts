import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptToken } from "@/lib/crypto/encrypt";

const KEY = "a".repeat(64);

function encrypted(plain: string) {
  return encryptToken(plain);
}

function row(expiresAt: string) {
  const access = encrypted("old_access");
  const refresh = encrypted("old_refresh");
  return {
    reddit_username: "iosdev_kim",
    access_token_ciphertext: access.ciphertext,
    access_token_iv: access.iv,
    access_token_tag: access.tag,
    refresh_token_ciphertext: refresh.ciphertext,
    refresh_token_iv: refresh.iv,
    refresh_token_tag: refresh.tag,
    expires_at: expiresAt,
  };
}

type Update = { table: string; values: Record<string, unknown>; userId?: string };

function fakeSupabase(updates: Update[], error: unknown = null) {
  return {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: string) {
              updates.push({ table, values, userId: `${column}=${value}` });
              return Promise.resolve({ error });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = KEY;
  vi.restoreAllMocks();
});

describe("resolveRedditToken", () => {
  it("returns the stored access token without refreshing when still valid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const updates: Update[] = [];
    const { resolveRedditToken } = await import("@/lib/reddit/session");

    const result = await resolveRedditToken({
      supabase: fakeSupabase(updates),
      userId: "user-1",
      connection: row(new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()),
    });

    expect(result.accessToken).toBe("old_access");
    expect(result.username).toBe("iosdev_kim");
    expect(result.refreshed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("refreshes an expired token and persists the new one", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new_access",
        token_type: "bearer",
        expires_in: 86400,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const updates: Update[] = [];
    const { resolveRedditToken } = await import("@/lib/reddit/session");

    const result = await resolveRedditToken({
      supabase: fakeSupabase(updates),
      userId: "user-1",
      connection: row(new Date(Date.now() - 1000).toISOString()),
    });

    expect(result.accessToken).toBe("new_access");
    expect(result.refreshed).toBe(true);

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://www.reddit.com/api/v1/access_token");
    const body = new URLSearchParams(init.body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old_refresh");

    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("reddit_connections");
    expect(updates[0].userId).toBe("user_id=user-1");
    expect(updates[0].values.access_token_ciphertext).toBeTypeOf("string");
    expect(updates[0].values.access_token_ciphertext).not.toBe("new_access");
    expect(updates[0].values.refresh_token_ciphertext).toBeUndefined();
  });

  it("still returns the fresh token when the DB update fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "new_access",
          token_type: "bearer",
          expires_in: 86400,
        }),
      })
    );
    const { resolveRedditToken } = await import("@/lib/reddit/session");

    const result = await resolveRedditToken({
      supabase: fakeSupabase([], { message: "db down" }),
      userId: "user-1",
      connection: row(new Date(Date.now() - 1000).toISOString()),
    });

    expect(result.accessToken).toBe("new_access");
  });

  it("throws when the refresh token itself is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: "invalid_grant" }),
      })
    );
    const { resolveRedditToken } = await import("@/lib/reddit/session");

    await expect(
      resolveRedditToken({
        supabase: fakeSupabase([]),
        userId: "user-1",
        connection: row(new Date(Date.now() - 1000).toISOString()),
      })
    ).rejects.toThrow(/invalid_grant/);
  });
});
