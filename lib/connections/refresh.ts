"use server";

import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/crypto/encrypt";
import { refreshToken as linkedInRefresh } from "@/lib/linkedin/oauth";
import { refreshLongLivedToken as threadsRefresh } from "@/lib/threads/oauth";
import { refreshLongLivedToken as instagramRefresh } from "@/lib/instagram/oauth";
import { revalidatePath } from "next/cache";

type Channel = "linkedin" | "threads" | "instagram";
type RefreshResult = { ok: boolean; expiresAt?: string; error?: string };

const TABLE: Record<Channel, string> = {
  linkedin: "linkedin_connections",
  threads: "threads_connections",
  instagram: "instagram_connections",
};

export async function refreshConnection(
  channel: Channel
): Promise<RefreshResult> {
  const user = await requireUser();
  const supabase = createClient();

  if (channel === "linkedin") {
    const { data: connection } = await supabase
      .from("linkedin_connections")
      .select(
        "refresh_token_ciphertext, refresh_token_iv, refresh_token_tag"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (!connection) {
      return { ok: false, error: "LinkedIn이 연결되지 않았습니다." };
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
        .eq("user_id", user.id);
      if (dbError) return { ok: false, error: dbError.message };

      revalidatePath("/settings/connections");
      return { ok: true, expiresAt };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "갱신 실패" };
    }
  }

  // Threads / Instagram: long-lived 토큰 자체 refresh (refresh_token 불필요)
  const { data: connection } = await supabase
    .from(TABLE[channel])
    .select("access_token_ciphertext, access_token_iv, access_token_tag")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    const label = channel === "threads" ? "Threads" : "Instagram";
    return { ok: false, error: `${label}이(가) 연결되지 않았습니다.` };
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
      .from(TABLE[channel])
      .update({
        access_token_ciphertext: enc.ciphertext,
        access_token_iv: enc.iv,
        access_token_tag: enc.tag,
        expires_at: expiresAt,
      })
      .eq("user_id", user.id);
    if (dbError) return { ok: false, error: dbError.message };

    revalidatePath("/settings/connections");
    return { ok: true, expiresAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "갱신 실패" };
  }
}
