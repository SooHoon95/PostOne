"use server";

import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encrypt";
import { publishPost } from "@/lib/linkedin/client";
import { revalidatePath } from "next/cache";

type Input = { content: string };
type Result = { urn?: string; error?: string };

const LINKEDIN_MAX = 3000;

export async function publishToLinkedIn({ content }: Input): Promise<Result> {
  const trimmed = content.trim();
  if (!trimmed) return { error: "내용을 입력해주세요." };
  if (trimmed.length > LINKEDIN_MAX) {
    return { error: `LinkedIn은 최대 ${LINKEDIN_MAX}자까지 가능합니다.` };
  }

  const user = await requireUser();
  const supabase = createClient();

  const { data: connection } = await supabase
    .from("linkedin_connections")
    .select(
      "linkedin_sub, access_token_ciphertext, access_token_iv, access_token_tag"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return {
      error:
        "LinkedIn이 연결되지 않았습니다. 채널 연동에서 먼저 연결해주세요.",
    };
  }

  const accessToken = decryptToken({
    ciphertext: connection.access_token_ciphertext,
    iv: connection.access_token_iv,
    tag: connection.access_token_tag,
  });

  try {
    const { urn } = await publishPost({
      accessToken,
      authorSub: connection.linkedin_sub,
      commentary: trimmed,
    });

    await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        content: trimmed,
        channel: "linkedin",
        external_id: urn,
        status: "success",
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    revalidatePath("/history");
    return { urn };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await supabase.from("posts").insert({
      user_id: user.id,
      content: trimmed,
      channel: "linkedin",
      status: "failed",
      error_message: msg,
    });
    return { error: msg };
  }
}
