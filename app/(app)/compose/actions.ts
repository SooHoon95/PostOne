"use server";

import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encrypt";
import { publishPost as linkedInPublish } from "@/lib/linkedin/client";
import { publishPost as threadsPublish } from "@/lib/threads/client";
import {
  isValidSubreddit,
  normalizeSubreddit,
  submitPost as redditSubmit,
  REDDIT_TITLE_MAX,
} from "@/lib/reddit/client";
import {
  REDDIT_CONNECTION_COLUMNS,
  resolveRedditToken,
  type RedditConnectionRow,
} from "@/lib/reddit/session";
import { publishSingle, publishCarousel } from "@/lib/instagram/client";
import type { Slide } from "@/lib/cards/text-split";
import { renderSlidesToImages } from "@/lib/cards/generator";
import {
  uploadCardImages,
  createBackgroundUploadUrl,
  BACKGROUND_ALLOWED_EXTS,
} from "@/lib/cards/upload";
import type { TemplateName } from "@/lib/cards/templates";
import { revalidatePath } from "next/cache";

type Input = { content: string; batchId?: string };
type Result = { urn?: string; permalink?: string; error?: string };
type MediaResult = { mediaId?: string; mediaUrls?: string[]; error?: string };

const LINKEDIN_MAX = 3000;
const THREADS_MAX = 500;
const INSTAGRAM_MAX = 2200;

// ─── LinkedIn ───────────────────────────────────────────────────────────────

export async function publishToLinkedIn({ content, batchId }: Input): Promise<Result> {
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
        batch_id: batchId ?? null,
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
      batch_id: batchId ?? null,
    });
    return { error: msg };
  }
}

// ─── Threads ────────────────────────────────────────────────────────────────

export async function publishToThreads({ content, batchId }: Input): Promise<Result> {
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
        batch_id: batchId ?? null,
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
      batch_id: batchId ?? null,
    });
    return { error: msg };
  }
}

// ─── Reddit ─────────────────────────────────────────────────────────────────

export type RedditInput = {
  content: string;
  batchId?: string;
  subreddit: string;
  title: string;
  link?: string; // 입력 시 링크 글, 없으면 본문으로 텍스트 글
  flairId?: string;
};

export async function publishToReddit({
  content,
  subreddit,
  title,
  link,
  flairId,
  batchId,
}: RedditInput): Promise<Result> {
  const sr = normalizeSubreddit(subreddit ?? "");
  const trimmedTitle = (title ?? "").trim();
  const trimmedLink = (link ?? "").trim();
  const body = content.trim();

  if (!sr) return { error: "서브레딧을 입력하세요." };
  if (!isValidSubreddit(sr)) {
    return { error: "서브레딧 이름이 올바르지 않습니다 (영문·숫자·밑줄 2~21자)." };
  }
  if (!trimmedTitle) return { error: "Reddit 제목을 입력하세요." };
  if (trimmedTitle.length > REDDIT_TITLE_MAX) {
    return { error: `Reddit 제목은 최대 ${REDDIT_TITLE_MAX}자입니다.` };
  }
  if (!trimmedLink && !body) return { error: "본문 또는 링크를 입력하세요." };
  if (trimmedLink && !/^https?:\/\//i.test(trimmedLink)) {
    return { error: "링크는 http(s)://로 시작해야 합니다." };
  }

  const user = await requireUser();
  const supabase = createClient();

  const { data: connection } = await supabase
    .from("reddit_connections")
    .select(REDDIT_CONNECTION_COLUMNS)
    .eq("user_id", user.id)
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
      userId: user.id,
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
      user_id: user.id,
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

    revalidatePath("/history");
    return { urn: result.fullname, permalink: result.permalink ?? undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await supabase.from("posts").insert({
      user_id: user.id,
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

export type InstagramCard = {
  title: string;       // 카드 제목 (빈 문자열 OK)
  description: string; // 카드 설명 (빈 문자열 OK)
  backgroundImageUrl?: string; // 카드 배경 이미지 (Storage public URL)
};

type InstagramInput = {
  cards: InstagramCard[];        // 빈 배열이면 1장 빈 카드
  template?: TemplateName;
  body?: string;                 // 본문 = 캡션 = 발행 기록(content)
  batchId?: string;
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
    backgroundImageUrl: card.backgroundImageUrl || undefined,
  }));
}

export type UploadResult = {
  path?: string;
  token?: string;
  publicUrl?: string;
  error?: string;
};

/**
 * 카드 배경 signed upload URL 발급. 파일 대신 확장자만 받아(작은 응답이라 body
 * 제한과 무관) signed token/path/publicUrl을 반환한다. 클라이언트가 이 토큰으로
 * Supabase Storage에 직접 업로드한다(Vercel 함수 우회).
 */
export async function createCardBgUpload(
  fileExt: string
): Promise<UploadResult> {
  const ext = fileExt.toLowerCase();
  if (!(BACKGROUND_ALLOWED_EXTS as readonly string[]).includes(ext)) {
    return { error: "JPG · PNG · WEBP 형식만 가능합니다." };
  }

  const user = await requireUser();
  try {
    const { path, token, publicUrl } = await createBackgroundUploadUrl(
      user.id,
      ext
    );
    return { path, token, publicUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "업로드 실패";
    return { error: msg };
  }
}

export async function publishToInstagram({
  cards,
  template = "minimal-white",
  body,
  batchId,
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
  // caption = 본문(body). 카드 자동합성 폴백을 쓰지 않는다 — 본문 없으면 빈 캡션("").
  // content(기록용)도 동일하게 본문만 저장한다.
  const cap = (body ?? "").trim().slice(0, INSTAGRAM_MAX);
  const storedBody = (body ?? "").trim();

  try {
    const images = await renderSlidesToImages(slides, template);
    const urls = await uploadCardImages(user.id, images);

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
      content: storedBody,
      channel: "instagram",
      external_id: mediaId,
      status: "success",
      media_urls: urls,
      instagram_cards: cards,
      published_at: new Date().toISOString(),
      batch_id: batchId ?? null,
    });

    revalidatePath("/history");
    return { mediaId, mediaUrls: urls };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await supabase.from("posts").insert({
      user_id: user.id,
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

export type Channel = "linkedin" | "threads" | "instagram" | "reddit";

export type RedditPublishInput = {
  subreddit: string;
  title: string;
  link?: string;
  flairId?: string;
};

export type MultiPublishInput = {
  channels: Channel[];
  body: string;                       // 공통 본문 (채널별 본문이 없을 때의 폴백)
  instagramCards: InstagramCard[];    // 빈 배열이면 빈 1장
  instagramTemplate?: TemplateName;
  reddit?: RedditPublishInput;        // Reddit 선택 시 서브레딧/제목(필수)
  /**
   * 채널별 맞춤 본문(AI 채널별 변환 결과). 해당 채널 키가 없거나 빈 문자열이면
   * body로 폴백한다 — 기존 호출부(body만 전달)와 호환.
   */
  channelContents?: Partial<Record<Channel, string>>;
};

export type ChannelResult = {
  channel: Channel;
  success: boolean;
  externalId?: string;
  permalink?: string;
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

  // 채널별 맞춤 본문 → 없으면 공통 body. 발행 직전에 trim해 빈 값은 폴백 처리.
  const contentFor = (channel: Channel): string => {
    const override = input.channelContents?.[channel];
    const tailored = typeof override === "string" ? override.trim() : "";
    return tailored || body;
  };

  // 이 멀티 발행 묶음을 식별하는 단일 batchId. 채널별 posts row가 동일 값으로
  // 저장되어 발행 이력에서 본문 단위로 그룹핑된다. (Node 서버 런타임)
  const batchId = crypto.randomUUID();

  for (const channel of channels) {
    if (channel === "linkedin") {
      const r = await publishToLinkedIn({ content: contentFor("linkedin"), batchId });
      results.push({
        channel,
        success: !r.error,
        externalId: r.urn,
        error: r.error,
      });
    } else if (channel === "threads") {
      const r = await publishToThreads({ content: contentFor("threads"), batchId });
      results.push({
        channel,
        success: !r.error,
        externalId: r.urn,
        error: r.error,
      });
    } else if (channel === "reddit") {
      const r = await publishToReddit({
        content: contentFor("reddit"),
        batchId,
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
      const r = await publishToInstagram({
        cards: instagramCards,
        template: input.instagramTemplate,
        // 본문 = 캡션 = 기록용 content. 카드 텍스트는 캡션이 아니다.
        body: contentFor("instagram"),
        batchId,
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
