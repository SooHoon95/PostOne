import { randomBytes } from "crypto";
import type {
  ThreadsTokenResponse,
  ThreadsLongLivedTokenResponse,
  ThreadsUserInfo,
} from "./types";

const AUTH_URL = "https://threads.net/oauth/authorize";
const TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const LONG_LIVED_URL = "https://graph.threads.net/access_token";
const REFRESH_URL = "https://graph.threads.net/refresh_access_token";
const USERINFO_URL = "https://graph.threads.net/v1.0/me";
const SCOPES = "threads_basic,threads_content_publish";

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthUrl(state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.THREADS_CLIENT_ID!);
  url.searchParams.set("redirect_uri", process.env.THREADS_REDIRECT_URI!);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(
  code: string
): Promise<ThreadsTokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.THREADS_CLIENT_ID!,
    client_secret: process.env.THREADS_CLIENT_SECRET!,
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.THREADS_REDIRECT_URI!,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Threads token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<ThreadsLongLivedTokenResponse> {
  const url = new URL(LONG_LIVED_URL);
  url.searchParams.set("grant_type", "th_exchange_token");
  url.searchParams.set("client_secret", process.env.THREADS_CLIENT_SECRET!);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Threads long-lived exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshLongLivedToken(
  accessToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(REFRESH_URL);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Threads token refresh failed: ${res.status} ${text}`);
  }
  const data: ThreadsLongLivedTokenResponse = await res.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function fetchUserInfo(
  accessToken: string
): Promise<ThreadsUserInfo> {
  const url = new URL(USERINFO_URL);
  url.searchParams.set(
    "fields",
    "id,username,threads_profile_picture_url,threads_biography"
  );
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Threads userinfo failed: ${res.status} ${text}`);
  }
  return res.json();
}
