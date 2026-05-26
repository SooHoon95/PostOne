import { randomBytes } from "crypto";
import type {
  FacebookTokenResponse,
  FacebookPagesResponse,
  InstagramAccountInfo,
} from "./types";

const FB_VERSION = "v18.0";
const AUTH_URL = `https://www.facebook.com/${FB_VERSION}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${FB_VERSION}/oauth/access_token`;
const LONG_LIVED_URL = `https://graph.facebook.com/${FB_VERSION}/oauth/access_token`;
const PAGES_URL = `https://graph.facebook.com/${FB_VERSION}/me/accounts`;
const IG_USER_URL = (igId: string) =>
  `https://graph.facebook.com/${FB_VERSION}/${igId}`;

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
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
): Promise<FacebookTokenResponse> {
  const url = new URL(TOKEN_URL);
  url.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID!);
  url.searchParams.set("client_secret", process.env.INSTAGRAM_APP_SECRET!);
  url.searchParams.set("redirect_uri", process.env.INSTAGRAM_REDIRECT_URI!);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Instagram(FB) token exchange failed: ${res.status} ${text}`
    );
  }
  return res.json();
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<FacebookTokenResponse> {
  const url = new URL(LONG_LIVED_URL);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID!);
  url.searchParams.set("client_secret", process.env.INSTAGRAM_APP_SECRET!);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Instagram(FB) long-lived exchange failed: ${res.status} ${text}`
    );
  }
  return res.json();
}

/**
 * 사용자의 첫 번째 IG Business 계정을 찾음.
 * FB Page → IG Business account 매핑 필요.
 */
export async function findInstagramBusinessAccount(
  userAccessToken: string
): Promise<InstagramAccountInfo> {
  const url = new URL(PAGES_URL);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account"
  );
  url.searchParams.set("access_token", userAccessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram pages lookup failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as FacebookPagesResponse;

  const pageWithIG = data.data.find((p) => p.instagram_business_account?.id);
  if (!pageWithIG || !pageWithIG.instagram_business_account) {
    throw new Error(
      "Instagram Business 계정이 연결된 Facebook Page를 찾을 수 없습니다. " +
        "Instagram을 Business/Creator 계정으로 전환하고 Facebook Page에 연결해주세요."
    );
  }

  const igId = pageWithIG.instagram_business_account.id;

  // 추가로 username 조회 (선택)
  let username: string | null = null;
  try {
    const igUrl = new URL(IG_USER_URL(igId));
    igUrl.searchParams.set("fields", "username");
    igUrl.searchParams.set("access_token", pageWithIG.access_token);
    const igRes = await fetch(igUrl.toString());
    if (igRes.ok) {
      const igData = (await igRes.json()) as { username?: string };
      username = igData.username ?? null;
    }
  } catch {
    // username 조회 실패는 치명적이지 않음
  }

  return {
    igUserId: igId,
    pageId: pageWithIG.id,
    username,
    pageAccessToken: pageWithIG.access_token,
  };
}
