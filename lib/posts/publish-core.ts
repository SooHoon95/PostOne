import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto/encrypt";
import { publishPost as linkedInPublish } from "@/lib/linkedin/client";
import { publishPost as threadsPublish } from "@/lib/threads/client";
import { submitPost as redditSubmit } from "@/lib/reddit/client";
import {
  REDDIT_CONNECTION_COLUMNS,
  resolveRedditToken,
  type RedditConnectionRow,
} from "@/lib/reddit/session";
import { publishSingle, publishCarousel } from "@/lib/instagram/client";
import type { Slide } from "@/lib/cards/text-split";
import { renderSlidesToImages } from "@/lib/cards/generator";
import { uploadCardImages } from "@/lib/cards/upload";
import type { TemplateName } from "@/lib/cards/templates";
import type {
  Channel,
  ChannelPublishResult,
  ChannelResult,
  InstagramCard,
  MediaPublishResult,
  MultiPublishInput,
} from "./types";
import {
  INSTAGRAM_MAX,
  validateLinkedInContent,
  validateRedditInput,
  validateThreadsContent,
} from "./validate";

/**
 * 채널 발행 코어.
 *
 * 세션(쿠키)·revalidate 같은 요청 컨텍스트에 의존하지 않고, 넘겨받은 Supabase
 * 클라이언트와 userId 만으로 발행한다. 서버 액션(즉시 발행)과 예약 발행 cron
 * (service role)이 같은 경로를 재사용한다.
 */

type Base = {
  supabase: SupabaseClient;
  userId: string;
  batchId?: string;
};

// ─── LinkedIn ───────────────────────────────────────────────────────────────

export async function publishLinkedInForUser({
  supabase,
  userId,
  content,
  batchId,
}: Base & { content: string }): Promise<ChannelPublishResult> {
  const invalid = validateLinkedInContent(content);
  if (invalid) return { error: invalid };
  const trimmed = content.trim();

  const { data: connection } = await supabase
    .from("linkedin_connections")
    .select(
      "linkedin_sub, access_token_ciphertext, access_token_iv, access_token_tag"
    )
    .eq("user_id", userId)
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
        user_id: userId,
        content: trimmed,
        channel: "linkedin",
        external_id: urn,
        status: "success",
        published_at: new Date().toISOString(),
        batch_id: batchId ?? null,
      })
      .select()
      .single();

    return { urn };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await supabase.from("posts").insert({
      user_id: userId,
      content: trimmed,
      channel: "linkedin",
      status: "failed",
      error_message: msg,
      batch_id: batchId ?? null,
    });
    return { error: msg };
  }
}

// ─── Threads ────────────────────────────────────────────────────────────────

export async function publishThreadsForUser({
  supabase,
  userId,
  content,
  batchId,
}: Base & { content: string }): Promise<ChannelPublishResult> {
  const invalid = validateThreadsContent(content);
  if (invalid) return { error: invalid };
  const trimmed = content.trim();

  const { data: connection } = await supabase
    .from("threads_connections")
    .select(
      "threads_user_id, access_token_ciphertext, access_token_iv, access_token_tag"
    )
    .eq("user_id", userId)
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

    await supabase.from("posts").insert({
      user_id: userId,
      content: trimmed,
      channel: "threads",
      external_id: mediaId,
      status: "success",
      published_at: new Date().toISOString(),
      batch_id: batchId ?? null,
    });

    return { urn: mediaId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await supabase.from("posts").insert({
      user_id: userId,
      content: trimmed,
      channel: "threads",
      status: "failed",
      error_message: msg,
      batch_id: batchId ?? null,
    });
    return { error: msg };
  }
}

// ─── Reddit ─────────────────────────────────────────────────────────────────

export async function publishRedditForUser({
  supabase,
  userId,
  content,
  subreddit,
  title,
  link,
  flairId,
  batchId,
}: Base & {
  content: string;
  subreddit: string;
  title: string;
  link?: string;
  flairId?: string;
}): Promise<ChannelPublishResult> {
  const body = content.trim();
  const reddit = validateRedditInput({ subreddit, title, link, body });
  if (reddit.error) return { error: reddit.error };
  const { subreddit: sr, title: trimmedTitle, link: trimmedLink } = reddit;

  const { data: connection } = await supabase
    .from("reddit_connections")
    .select(REDDIT_CONNECTION_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (!connection) {
    return {
      error: "Reddit이 연결되지 않았습니다. 채널 연동에서 먼저 연결해주세요.",
    };
  }

  // 링크 글은 본문을 쓰지 않으므로 기록에는 링크를 본문으로 남긴다.
  const storedContent = trimmedLink || body;

  try {
    const { accessToken } = await resolveRedditToken({
      supabase,
      userId,
      connection: connection as unknown as RedditConnectionRow,
    });

    const result = await redditSubmit({
      accessToken,
      subreddit: sr,
      title: trimmedTitle,
      body,
      url: trimmedLink || undefined,
      flairId: flairId || undefined,
    });

    await supabase.from("posts").insert({
      user_id: userId,
      content: storedContent,
      channel: "reddit",
      external_id: result.fullname,
      status: "success",
      subreddit: sr,
      title: trimmedTitle,
      flair_id: flairId || null,
      permalink: result.permalink,
      published_at: new Date().toISOString(),
      batch_id: batchId ?? null,
    });

    return { urn: result.fullname, permalink: result.permalink ?? undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await supabase.from("posts").insert({
      user_id: userId,
      content: storedContent,
      channel: "reddit",
      status: "failed",
      error_message: msg,
      subreddit: sr,
      title: trimmedTitle,
      flair_id: flairId || null,
      batch_id: batchId ?? null,
    });
    return { error: msg };
  }
}

// ─── Instagram ──────────────────────────────────────────────────────────────

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
    backgroundImageUrl: card.backgroundImageUrl || undefined,
  }));
}

export async function publishInstagramForUser({
  supabase,
  userId,
  cards,
  template = "minimal-white",
  body,
  batchId,
}: Base & {
  cards: InstagramCard[];
  template?: TemplateName;
  body?: string;
}): Promise<MediaPublishResult> {
  const { data: connection } = await supabase
    .from("instagram_connections")
    .select(
      "instagram_business_id, access_token_ciphertext, access_token_iv, access_token_tag"
    )
    .eq("user_id", userId)
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
  // caption = 본문(body). 카드 자동합성 폴백을 쓰지 않는다 — 본문 없으면 빈 캡션("").
  // content(기록용)도 동일하게 본문만 저장한다.
  const cap = (body ?? "").trim().slice(0, INSTAGRAM_MAX);
  const storedBody = (body ?? "").trim();

  try {
    const images = await renderSlidesToImages(slides, template);
    const urls = await uploadCardImages(userId, images);

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
      user_id: userId,
      content: storedBody,
      channel: "instagram",
      external_id: mediaId,
      status: "success",
      media_urls: urls,
      instagram_cards: cards,
      published_at: new Date().toISOString(),
      batch_id: batchId ?? null,
    });

    return { mediaId, mediaUrls: urls };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await supabase.from("posts").insert({
      user_id: userId,
      content: storedBody,
      channel: "instagram",
      status: "failed",
      error_message: msg,
      instagram_cards: cards,
      batch_id: batchId ?? null,
    });
    return { error: msg };
  }
}

// ─── Multi-channel ──────────────────────────────────────────────────────────

export type MultiPublishOptions = {
  /** 이미 성공한 채널 — 재시도 시 중복 발행을 막기 위해 건너뛴다. */
  skipChannels?: Channel[];
};

/**
 * 선택 채널들을 순서대로 발행한다.
 * batchId 를 주지 않으면 이번 묶음용 UUID를 만든다(예약 발행은 예약 시점에
 * 만든 batch_id 를 그대로 넘겨 재시도해도 같은 묶음으로 남긴다).
 */
export async function publishMultiForUser({
  supabase,
  userId,
  input,
  batchId,
  skipChannels = [],
}: {
  supabase: SupabaseClient;
  userId: string;
  input: MultiPublishInput;
  batchId?: string;
} & MultiPublishOptions): Promise<{ results: ChannelResult[]; batchId: string }> {
  const { channels, body, instagramCards } = input;
  const resolvedBatchId = batchId ?? crypto.randomUUID();
  const skip = new Set<Channel>(skipChannels);

  if (channels.length === 0) {
    return {
      batchId: resolvedBatchId,
      results: [
        {
          channel: "linkedin",
          success: false,
          error: "채널을 1개 이상 선택하세요.",
        },
      ],
    };
  }

  const results: ChannelResult[] = [];

  // 채널별 맞춤 본문 → 없으면 공통 body. 발행 직전에 trim해 빈 값은 폴백 처리.
  const contentFor = (channel: Channel): string => {
    const override = input.channelContents?.[channel];
    const tailored = typeof override === "string" ? override.trim() : "";
    return tailored || body;
  };

  for (const channel of channels) {
    if (skip.has(channel)) continue;

    if (channel === "linkedin") {
      const r = await publishLinkedInForUser({
        supabase,
        userId,
        content: contentFor("linkedin"),
        batchId: resolvedBatchId,
      });
      results.push({
        channel,
        success: !r.error,
        externalId: r.urn,
        error: r.error,
      });
    } else if (channel === "threads") {
      const r = await publishThreadsForUser({
        supabase,
        userId,
        content: contentFor("threads"),
        batchId: resolvedBatchId,
      });
      results.push({
        channel,
        success: !r.error,
        externalId: r.urn,
        error: r.error,
      });
    } else if (channel === "reddit") {
      const r = await publishRedditForUser({
        supabase,
        userId,
        content: contentFor("reddit"),
        batchId: resolvedBatchId,
        subreddit: input.reddit?.subreddit ?? "",
        title: input.reddit?.title ?? "",
        link: input.reddit?.link,
        flairId: input.reddit?.flairId,
      });
      results.push({
        channel,
        success: !r.error,
        externalId: r.urn,
        permalink: r.permalink,
        error: r.error,
      });
    } else if (channel === "instagram") {
      const r = await publishInstagramForUser({
        supabase,
        userId,
        cards: instagramCards,
        template: input.instagramTemplate,
        // 본문 = 캡션 = 기록용 content. 카드 텍스트는 캡션이 아니다.
        body: contentFor("instagram"),
        batchId: resolvedBatchId,
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

  return { results, batchId: resolvedBatchId };
}
