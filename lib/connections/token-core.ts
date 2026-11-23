import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptToken, decryptToken } from "@/lib/crypto/encrypt";
import { refreshToken as linkedInRefresh } from "@/lib/linkedin/oauth";
import { refreshLongLivedToken as threadsRefresh } from "@/lib/threads/oauth";
import { refreshLongLivedToken as instagramRefresh } from "@/lib/instagram/oauth";
import { refreshAccessToken as redditRefresh } from "@/lib/reddit/oauth";

/**
 * 연결 토큰 갱신 코어 — 세션 없이도(서버 액션 · 예약 발행 cron · 토큰 갱신 cron)
 * 동작하도록 Supabase 클라이언트와 userId 를 인자로 받는다.
 */

export type RefreshableChannel =
  | "linkedin"
  | "threads"
  | "instagram"
  | "reddit";

export type TokenRefreshResult = {
  ok: boolean;
  expiresAt?: string;
  error?: string;
};

export const CONNECTION_TABLE: Record<RefreshableChannel, string> = {
  linkedin: "linkedin_connections",
  threads: "threads_connections",
  instagram: "instagram_connections",
  reddit: "reddit_connections",
};

const LABEL: Record<RefreshableChannel, string> = {
  linkedin: "LinkedIn",
  threads: "Threads",
  instagram: "Instagram",
  reddit: "Reddit",
};

const SAVE_ERROR = "갱신 정보 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.";
const REFRESH_ERROR = "토큰 갱신에 실패했습니다. 재연동이 필요할 수 있습니다.";

export async function refreshConnectionForUser({
  supabase,
  userId,
  channel,
}: {
  supabase: SupabaseClient;
  userId: string;
  channel: RefreshableChannel;
}): Promise<TokenRefreshResult> {
  // LinkedIn / Reddit: refresh_token 으로 새 access token 발급
  if (channel === "linkedin" || channel === "reddit") {
    const { data: connection } = await supabase
      .from(CONNECTION_TABLE[channel])
      .select(
        "refresh_token_ciphertext, refresh_token_iv, refresh_token_tag"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (!connection) {
      return { ok: false, error: `${LABEL[channel]}이(가) 연결되지 않았습니다.` };
    }
    if (
      !connection.refresh_token_ciphertext ||
      !connection.refresh_token_iv ||
      !connection.refresh_token_tag
    ) {
      return { ok: false, error: "재연동이 필요합니다 (refresh 토큰 없음)" };
    }

    const currentRefresh = decryptToken({
      ciphertext: connection.refresh_token_ciphertext,
      iv: connection.refresh_token_iv,
      tag: connection.refresh_token_tag,
    });

    try {
      if (channel === "linkedin") {
        const { accessToken, refreshToken, expiresIn } =
          await linkedInRefresh(currentRefresh);
        const enc = encryptToken(accessToken);
        const refreshEnc = refreshToken ? encryptToken(refreshToken) : null;
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        const update: Record<string, string> = {
          access_token_ciphertext: enc.ciphertext,
          access_token_iv: enc.iv,
          access_token_tag: enc.tag,
          expires_at: expiresAt,
        };
        if (refreshEnc) {
          update.refresh_token_ciphertext = refreshEnc.ciphertext;
          update.refresh_token_iv = refreshEnc.iv;
          update.refresh_token_tag = refreshEnc.tag;
        }

        const { error: dbError } = await supabase
          .from("linkedin_connections")
          .update(update)
          .eq("user_id", userId);
        if (dbError) return { ok: false, error: SAVE_ERROR };

        return { ok: true, expiresAt };
      }

      // Reddit: refresh_token 은 보통 그대로, 회전 시에만 교체 저장
      const { accessToken, refreshToken, expiresIn } =
        await redditRefresh(currentRefresh);
      const enc = encryptToken(accessToken);
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      const update: Record<string, string> = {
        access_token_ciphertext: enc.ciphertext,
        access_token_iv: enc.iv,
        access_token_tag: enc.tag,
        expires_at: expiresAt,
      };
      if (refreshToken) {
        const refreshEnc = encryptToken(refreshToken);
        update.refresh_token_ciphertext = refreshEnc.ciphertext;
        update.refresh_token_iv = refreshEnc.iv;
        update.refresh_token_tag = refreshEnc.tag;
      }

      const { error: dbError } = await supabase
        .from("reddit_connections")
        .update(update)
        .eq("user_id", userId);
      if (dbError) return { ok: false, error: SAVE_ERROR };

      return { ok: true, expiresAt };
    } catch {
      return { ok: false, error: REFRESH_ERROR };
    }
  }

  // Threads / Instagram: long-lived 토큰 자체 refresh (refresh_token 불필요)
  const { data: connection } = await supabase
    .from(CONNECTION_TABLE[channel])
    .select("access_token_ciphertext, access_token_iv, access_token_tag")
    .eq("user_id", userId)
    .maybeSingle();

  if (!connection) {
    return { ok: false, error: `${LABEL[channel]}이(가) 연결되지 않았습니다.` };
  }

  const accessToken = decryptToken({
    ciphertext: connection.access_token_ciphertext,
    iv: connection.access_token_iv,
    tag: connection.access_token_tag,
  });

  try {
    const refresh = channel === "threads" ? threadsRefresh : instagramRefresh;
    const { accessToken: newToken, expiresIn } = await refresh(accessToken);
    const enc = encryptToken(newToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error: dbError } = await supabase
      .from(CONNECTION_TABLE[channel])
      .update({
        access_token_ciphertext: enc.ciphertext,
        access_token_iv: enc.iv,
        access_token_tag: enc.tag,
        expires_at: expiresAt,
      })
      .eq("user_id", userId);
    if (dbError) return { ok: false, error: SAVE_ERROR };

    return { ok: true, expiresAt };
  } catch {
    return { ok: false, error: REFRESH_ERROR };
  }
}

export type ExpiringConnection = {
  user_id: string;
  channel: RefreshableChannel;
  expires_at: string;
};

const REFRESHABLE_CHANNELS: RefreshableChannel[] = [
  "linkedin",
  "threads",
  "instagram",
  "reddit",
];

/**
 * 만료가 임박한 연결 목록 — service role 클라이언트(RLS 우회)로 전체 사용자 조회.
 * 토큰 갱신 cron 이 사용한다.
 */
export async function listExpiringConnections({
  supabase,
  before,
  limitPerChannel = 50,
}: {
  supabase: SupabaseClient;
  before: string;
  limitPerChannel?: number;
}): Promise<ExpiringConnection[]> {
  const results: ExpiringConnection[] = [];

  for (const channel of REFRESHABLE_CHANNELS) {
    const { data } = await supabase
      .from(CONNECTION_TABLE[channel])
      .select("user_id, expires_at")
      .lt("expires_at", before)
      .order("expires_at", { ascending: true })
      .limit(limitPerChannel);

    for (const row of (data ?? []) as { user_id: string; expires_at: string }[]) {
      results.push({
        user_id: row.user_id,
        channel,
        expires_at: row.expires_at,
      });
    }
  }

  return results;
}

/**
 * 발행 직전 토큰 점검 — 만료(또는 임박)한 연결만 갱신한다.
 * 갱신 실패는 발행을 막지 않는다(발행 시점에 실제 오류로 드러난다).
 */
export async function ensureFreshConnections({
  supabase,
  userId,
  channels,
  windowMs = 10 * 60 * 1000,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  userId: string;
  channels: RefreshableChannel[];
  windowMs?: number;
  now?: Date;
}): Promise<TokenRefreshResult[]> {
  const results: TokenRefreshResult[] = [];
  const threshold = now.getTime() + windowMs;

  for (const channel of channels) {
    const { data } = await supabase
      .from(CONNECTION_TABLE[channel])
      .select("expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    // 연결이 없으면 발행 코어가 "연결되지 않음" 오류를 돌려준다.
    if (!data?.expires_at) continue;

    const expiresAt = new Date(data.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt > threshold) continue;

    results.push(
      await refreshConnectionForUser({ supabase, userId, channel })
    );
  }

  return results;
}
