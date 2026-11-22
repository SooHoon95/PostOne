import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@/lib/crypto/encrypt";
import { isExpired, refreshAccessToken } from "./oauth";

/** reddit_connections 행 중 토큰 사용에 필요한 컬럼 */
export type RedditConnectionRow = {
  reddit_username: string;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  refresh_token_tag: string;
  expires_at: string;
};

export const REDDIT_CONNECTION_COLUMNS =
  "reddit_username, access_token_ciphertext, access_token_iv, access_token_tag, " +
  "refresh_token_ciphertext, refresh_token_iv, refresh_token_tag, expires_at";

export type ResolvedRedditToken = {
  accessToken: string;
  username: string;
  /** refresh 로 교체되어 DB 에 반영됐는지 */
  refreshed: boolean;
};

/**
 * 저장된 연결에서 바로 쓸 수 있는 access token 확보.
 * 만료(60초 여유)면 refresh_token 으로 갱신하고 새 토큰을 DB 에 반영한다.
 * DB 반영이 실패해도 새 토큰 자체는 유효하므로 발행은 계속 진행한다.
 */
export async function resolveRedditToken({
  supabase,
  userId,
  connection,
}: {
  supabase: SupabaseClient;
  userId: string;
  connection: RedditConnectionRow;
}): Promise<ResolvedRedditToken> {
  const accessToken = decryptToken({
    ciphertext: connection.access_token_ciphertext,
    iv: connection.access_token_iv,
    tag: connection.access_token_tag,
  });

  if (!isExpired(connection.expires_at)) {
    return {
      accessToken,
      username: connection.reddit_username,
      refreshed: false,
    };
  }

  const refreshToken = decryptToken({
    ciphertext: connection.refresh_token_ciphertext,
    iv: connection.refresh_token_iv,
    tag: connection.refresh_token_tag,
  });

  const {
    accessToken: newToken,
    expiresIn,
    refreshToken: rotated,
  } = await refreshAccessToken(refreshToken);

  const enc = encryptToken(newToken);
  const update: Record<string, string> = {
    access_token_ciphertext: enc.ciphertext,
    access_token_iv: enc.iv,
    access_token_tag: enc.tag,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
  if (rotated) {
    const refreshEnc = encryptToken(rotated);
    update.refresh_token_ciphertext = refreshEnc.ciphertext;
    update.refresh_token_iv = refreshEnc.iv;
    update.refresh_token_tag = refreshEnc.tag;
  }

  await supabase.from("reddit_connections").update(update).eq("user_id", userId);

  return {
    accessToken: newToken,
    username: connection.reddit_username,
    refreshed: true,
  };
}
