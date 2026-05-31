"use server";

import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encrypt";
import { publishPost as linkedInPublish } from "@/lib/linkedin/client";
import { publishPost as threadsPublish } from "@/lib/threads/client";
import { publishSingle, publishCarousel } from "@/lib/instagram/client";
import type { Slide } from "@/lib/cards/text-split";
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

export type InstagramCard = {
  title: string;       // 카드 제목 (빈 문자열 OK)
  description: string; // 카드 설명 (빈 문자열 OK)
};

type InstagramInput = {
  cards: InstagramCard[];        // 빈 배열이면 1장 빈 카드
  template?: TemplateName;
  caption?: string;              // 게시물 캡션 (이미지 아래 텍스트)
};

function cardsToSlides(cards: InstagramCard[]): Slide[] {
  // 카드 없으면 빈 1장
  if (cards.length === 0) {
    return [{ index: 0, total: 1, body: "" }];
  }
  return cards.map((card, i) => ({
    index: i,
    total: cards.length,
    title: card.title.trim() || undefined,
    body: card.description.trim(),
  }));
}

function buildCaption(cards: InstagramCard[], override?: string): string {
  if (override !== undefined) return override.slice(0, INSTAGRAM_MAX);
  if (cards.length === 0) return "";
  // 카드들의 제목/설명을 합쳐서 자동 캡션 생성
  const auto = cards
    .map((c) => [c.title, c.description].filter(Boolean).join(" — "))
    .filter(Boolean)
    .join("\n\n");
  return auto.slice(0, INSTAGRAM_MAX);
}

export async function publishToInstagram({
  cards,
  template = "minimal-white",
  caption,
}: InstagramInput): Promise<MediaResult> {
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

  const slides = cardsToSlides(cards);
  const cap = buildCaption(cards, caption);
  const storedContent = cards
    .map((c) => `[${c.title}] ${c.description}`)
    .join("\n");

  try {
    const pngs = await renderSlidesToPngs(slides, template);
    const urls = await uploadCardPngs(user.id, pngs);

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
      content: storedContent || "(빈 카드)",
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
      content: storedContent || "(빈 카드)",
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
  channels: Channel[];
  body: string;                       // LinkedIn + Threads
  instagramCards: InstagramCard[];    // 빈 배열이면 빈 1장
  instagramTemplate?: TemplateName;
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
  const { channels, body, instagramCards } = input;
  if (channels.length === 0) {
    return {
      results: [
        { channel: "linkedin", success: false, error: "채널을 1개 이상 선택하세요." },
      ],
    };
  }

  const results: ChannelResult[] = [];

  for (const channel of channels) {
    if (channel === "linkedin") {
      const r = await publishToLinkedIn({ content: body });
      results.push({
        channel,
        success: !r.error,
        externalId: r.urn,
        error: r.error,
      });
    } else if (channel === "threads") {
      const r = await publishToThreads({ content: body });
      results.push({
        channel,
        success: !r.error,
        externalId: r.urn,
        error: r.error,
      });
    } else if (channel === "instagram") {
      const r = await publishToInstagram({
        cards: instagramCards,
        template: input.instagramTemplate,
        // 인스타 캡션 = 본문 (본문도 그대로 게시). 카드는 카드만 담당.
        // 본문 없으면 publishToInstagram이 카드 제목/설명으로 자동 생성.
        caption: body.trim() || undefined,
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
