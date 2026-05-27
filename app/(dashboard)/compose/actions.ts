"use server";

import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encrypt";
import { publishPost as linkedInPublish } from "@/lib/linkedin/client";
import { publishPost as threadsPublish } from "@/lib/threads/client";
import { publishSingle, publishCarousel } from "@/lib/instagram/client";
import { splitToSlides } from "@/lib/cards/text-split";
import { renderSlidesToPngs } from "@/lib/cards/generator";
import { uploadCardPngs } from "@/lib/cards/upload";
import type { TemplateName } from "@/lib/cards/templates";
import { revalidatePath } from "next/cache";

type Input = { content: string };
type Result = { urn?: string; error?: string };
type MediaResult = { mediaId?: string; mediaUrls?: string[]; error?: string };

const LINKEDIN_MAX = 3000;
const THREADS_MAX = 500;
const INSTAGRAM_MAX = 2200;

// ─── LinkedIn ───────────────────────────────────────────────────────────────

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
    const { urn } = await linkedInPublish({
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

// ─── Threads ────────────────────────────────────────────────────────────────

export async function publishToThreads({ content }: Input): Promise<Result> {
  const trimmed = content.trim();
  if (!trimmed) return { error: "내용을 입력해주세요." };
  if (trimmed.length > THREADS_MAX) {
    return { error: `Threads는 최대 ${THREADS_MAX}자까지 가능합니다.` };
  }

  const user = await requireUser();
  const supabase = createClient();

  const { data: connection } = await supabase
    .from("threads_connections")
    .select(
      "threads_user_id, access_token_ciphertext, access_token_iv, access_token_tag"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return {
      error: "Threads가 연결되지 않았습니다. 채널 연동에서 먼저 연결해주세요.",
    };
  }

  const accessToken = decryptToken({
    ciphertext: connection.access_token_ciphertext,
    iv: connection.access_token_iv,
    tag: connection.access_token_tag,
  });

  try {
    const { mediaId } = await threadsPublish({
      accessToken,
      userId: connection.threads_user_id,
      text: trimmed,
    });

    await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        content: trimmed,
        channel: "threads",
        external_id: mediaId,
        status: "success",
        published_at: new Date().toISOString(),
      });

    revalidatePath("/history");
    return { urn: mediaId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await supabase.from("posts").insert({
      user_id: user.id,
      content: trimmed,
      channel: "threads",
      status: "failed",
      error_message: msg,
    });
    return { error: msg };
  }
}

// ─── Instagram ──────────────────────────────────────────────────────────────

type InstagramInput = Input & {
  template?: TemplateName;
  title?: string;
  caption?: string; // 캡션 (없으면 content 사용)
};

export async function publishToInstagram({
  content,
  template = "minimal-white",
  title,
  caption,
}: InstagramInput): Promise<MediaResult> {
  const trimmed = content.trim();
  if (!trimmed) return { error: "내용을 입력해주세요." };

  const cap = (caption ?? trimmed).slice(0, INSTAGRAM_MAX);

  const user = await requireUser();
  const supabase = createClient();

  const { data: connection } = await supabase
    .from("instagram_connections")
    .select(
      "instagram_business_id, access_token_ciphertext, access_token_iv, access_token_tag"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return {
      error:
        "Instagram이 연결되지 않았습니다. 채널 연동에서 먼저 연결해주세요.",
    };
  }

  const accessToken = decryptToken({
    ciphertext: connection.access_token_ciphertext,
    iv: connection.access_token_iv,
    tag: connection.access_token_tag,
  });

  try {
    // 1) 텍스트 → 슬라이드 분할
    const slides = splitToSlides(trimmed, title);
    if (slides.length === 0) return { error: "분할 가능한 내용이 없습니다." };

    // 2) 슬라이드 → PNG
    const pngs = await renderSlidesToPngs(slides, template);

    // 3) PNG → Supabase Storage 업로드 → 공개 URL
    const urls = await uploadCardPngs(user.id, pngs);

    // 4) Instagram 발행 (1장이면 single, 2~10장이면 carousel)
    let mediaId: string;
    if (urls.length === 1) {
      const r = await publishSingle({
        accessToken,
        igUserId: connection.instagram_business_id,
        imageUrl: urls[0],
        caption: cap,
      });
      mediaId = r.mediaId;
    } else {
      const r = await publishCarousel({
        accessToken,
        igUserId: connection.instagram_business_id,
        imageUrls: urls,
        caption: cap,
      });
      mediaId = r.mediaId;
    }

    await supabase.from("posts").insert({
      user_id: user.id,
      content: trimmed,
      channel: "instagram",
      external_id: mediaId,
      status: "success",
      media_urls: urls,
      published_at: new Date().toISOString(),
    });

    revalidatePath("/history");
    return { mediaId, mediaUrls: urls };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await supabase.from("posts").insert({
      user_id: user.id,
      content: trimmed,
      channel: "instagram",
      status: "failed",
      error_message: msg,
    });
    return { error: msg };
  }
}

// ─── Multi-channel ──────────────────────────────────────────────────────────

export type Channel = "linkedin" | "threads" | "instagram";

export type MultiPublishInput = {
  content: string;
  channels: Channel[];
  instagramTemplate?: TemplateName;
  instagramTitle?: string;
  instagramCaption?: string;
};

export type ChannelResult = {
  channel: Channel;
  success: boolean;
  externalId?: string;
  mediaUrls?: string[];
  error?: string;
};

export async function publishMulti(
  input: MultiPublishInput
): Promise<{ results: ChannelResult[] }> {
  const { content, channels } = input;
  if (channels.length === 0) {
    return { results: [{ channel: "linkedin", success: false, error: "채널을 1개 이상 선택하세요." }] };
  }

  const results: ChannelResult[] = [];

  // 순차 실행 (API rate-limit 보호). 병렬화는 v1.1+ 최적화.
  for (const channel of channels) {
    if (channel === "linkedin") {
      const r = await publishToLinkedIn({ content });
      results.push({
        channel,
        success: !r.error,
        externalId: r.urn,
        error: r.error,
      });
    } else if (channel === "threads") {
      const r = await publishToThreads({ content });
      results.push({
        channel,
        success: !r.error,
        externalId: r.urn,
        error: r.error,
      });
    } else if (channel === "instagram") {
      const r = await publishToInstagram({
        content,
        template: input.instagramTemplate,
        title: input.instagramTitle,
        caption: input.instagramCaption,
      });
      results.push({
        channel,
        success: !r.error,
        externalId: r.mediaId,
        mediaUrls: r.mediaUrls,
        error: r.error,
      });
    }
  }

  return { results };
}
