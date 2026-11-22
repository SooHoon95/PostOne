import { randomBytes } from "crypto";
import type { RedditMe, RedditTokenResponse } from "./types";

const AUTH_URL = "https://www.reddit.com/api/v1/authorize";
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REVOKE_URL = "https://www.reddit.com/api/v1/revoke_token";
const ME_URL = "https://oauth.reddit.com/api/v1/me";

/** Reddit 은 모든 요청에 고유 User-Agent 를 요구한다 (없으면 429/차단). */
export const REDDIT_USER_AGENT =
  process.env.REDDIT_USER_AGENT ?? "web:postone:0.1.0";

/** permanent 토큰 발급용 scope. authorize 는 콤마, 토큰 응답은 공백 구분. */
export const REDDIT_SCOPES = ["identity", "submit", "read", "flair"] as const;

export type RedditRefreshResult = {
  accessToken: string;
  expiresIn: number;
  /** Reddit 은 원칙적으로 refresh_token 을 회전시키지 않는다 (회전 시에만 값 존재) */
  refreshToken: string | null;
};

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthUrl(state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", process.env.REDDIT_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", process.env.REDDIT_REDIRECT_URI!);
  url.searchParams.set("duration", "permanent");
  url.searchParams.set("scope", REDDIT_SCOPES.join(","));
  return url.toString();
}

function basicAuth(): string {
  const id = process.env.REDDIT_CLIENT_ID ?? "";
  const secret = process.env.REDDIT_CLIENT_SECRET ?? "";
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function requestToken(body: URLSearchParams): Promise<RedditTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": REDDIT_USER_AGENT,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Reddit token request failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as RedditTokenResponse & { error?: string };
  // 잘못된 code/refresh_token 은 HTTP 200 + { error: "invalid_grant" } 로 온다.
  if (data.error) {
    throw new Error(`Reddit token request failed: ${data.error}`);
  }
  if (!data.access_token) {
    throw new Error("Reddit token request failed: empty access_token");
  }
  return data;
}

export async function exchangeCodeForToken(
  code: string
): Promise<RedditTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.REDDIT_REDIRECT_URI!,
  });
  return requestToken(body);
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<RedditRefreshResult> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const data = await requestToken(body);
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token ?? null,
  };
}

export async function fetchUserInfo(accessToken: string): Promise<RedditMe> {
  const res = await fetch(ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": REDDIT_USER_AGENT,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Reddit userinfo failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RedditMe;
}

/** 연결 해제 시 토큰 폐기 (실패해도 DB 정리는 진행). */
export async function revokeToken(
  token: string,
  hint: "access_token" | "refresh_token"
): Promise<void> {
  const body = new URLSearchParams({ token, token_type_hint: hint });
  const res = await fetch(REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": REDDIT_USER_AGENT,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Reddit revoke failed: ${res.status} ${text}`);
  }
}

/**
 * access token 만료 여부. 만료 시각을 알 수 없으면 갱신 대상으로 본다.
 * skewSeconds: 만료 직전 요청 실패를 줄이기 위한 여유(기본 60초).
 */
export function isExpired(
  expiresAt: string | number | Date,
  skewSeconds = 60
): boolean {
  const ms =
    expiresAt instanceof Date
      ? expiresAt.getTime()
      : typeof expiresAt === "number"
      ? expiresAt
      : Date.parse(expiresAt);
  if (Number.isNaN(ms)) return true;
  return ms - skewSeconds * 1000 <= Date.now();
}
