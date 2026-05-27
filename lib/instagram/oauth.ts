// Instagram API with Business Login (2024+ NEW API)
// Reference: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
import { randomBytes } from "crypto";
import type {
  InstagramShortTokenResponse,
  InstagramLongTokenResponse,
  InstagramUserInfo,
} from "./types";

const AUTH_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const LONG_LIVED_URL = "https://graph.instagram.com/access_token";
const USERINFO_URL = "https://graph.instagram.com/v21.0/me";

const SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
].join(",");

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthUrl(state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID!);
  url.searchParams.set("redirect_uri", process.env.INSTAGRAM_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(
  code: string
): Promise<InstagramShortTokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
    code,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<InstagramLongTokenResponse> {
  const url = new URL(LONG_LIVED_URL);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", process.env.INSTAGRAM_APP_SECRET!);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Instagram long-lived exchange failed: ${res.status} ${text}`
    );
  }
  return res.json();
}

export async function fetchUserInfo(
  accessToken: string
): Promise<InstagramUserInfo> {
  const url = new URL(USERINFO_URL);
  url.searchParams.set("fields", "id,user_id,username,account_type");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram userinfo failed: ${res.status} ${text}`);
  }
  return res.json();
}
