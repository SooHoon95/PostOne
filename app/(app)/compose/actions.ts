"use server";

import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  createBackgroundUploadUrl,
  BACKGROUND_ALLOWED_EXTS,
} from "@/lib/cards/upload";
import {
  publishInstagramForUser,
  publishLinkedInForUser,
  publishMultiForUser,
  publishRedditForUser,
  publishThreadsForUser,
} from "@/lib/posts/publish-core";
import {
  validateLinkedInContent,
  validateMultiPublishInput,
  validateRedditInput,
  validateThreadsContent,
} from "@/lib/posts/validate";
import { schedulePostForUser, parseScheduledAt } from "@/lib/scheduling/queries";
import type {
  Channel,
  ChannelPublishResult,
  ChannelResult,
  InstagramCard,
  MediaPublishResult,
  MultiPublishInput,
  RedditPublishInput,
} from "@/lib/posts/types";
import type { TemplateName } from "@/lib/cards/templates";

export type {
  Channel,
  ChannelResult,
  InstagramCard,
  MultiPublishInput,
  RedditPublishInput,
};

type Input = { content: string; batchId?: string };
type Result = ChannelPublishResult;
type MediaResult = MediaPublishResult;

// 발행 코어는 lib/posts/publish-core 에 있다 — 서버 액션은 세션 확인과
// 캐시 무효화만 담당하고, 예약 발행 cron 도 같은 코어를 재사용한다.

// ─── LinkedIn ───────────────────────────────────────────────────────────────

export async function publishToLinkedIn({
  content,
  batchId,
}: Input): Promise<Result> {
  const invalid = validateLinkedInContent(content);
  if (invalid) return { error: invalid };

  const user = await requireUser();
  const supabase = createClient();

  const result = await publishLinkedInForUser({
    supabase,
    userId: user.id,
    content,
    batchId,
  });
  if (!result.error) revalidatePath("/history");
  return result;
}

// ─── Threads ────────────────────────────────────────────────────────────────

export async function publishToThreads({
  content,
  batchId,
}: Input): Promise<Result> {
  const invalid = validateThreadsContent(content);
  if (invalid) return { error: invalid };

  const user = await requireUser();
  const supabase = createClient();

  const result = await publishThreadsForUser({
    supabase,
    userId: user.id,
    content,
    batchId,
  });
  if (!result.error) revalidatePath("/history");
  return result;
}

// ─── Reddit ─────────────────────────────────────────────────────────────────

export type RedditInput = RedditPublishInput & {
  content: string;
  batchId?: string;
};

export async function publishToReddit({
  content,
  subreddit,
  title,
  link,
  flairId,
  batchId,
}: RedditInput): Promise<Result> {
  const invalid = validateRedditInput({
    subreddit,
    title,
    link,
    body: content,
  }).error;
  if (invalid) return { error: invalid };

  const user = await requireUser();
  const supabase = createClient();

  const result = await publishRedditForUser({
    supabase,
    userId: user.id,
    content,
    subreddit,
    title,
    link,
    flairId,
    batchId,
  });
  if (!result.error) revalidatePath("/history");
  return result;
}

// ─── Instagram ──────────────────────────────────────────────────────────────

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

type InstagramInput = {
  cards: InstagramCard[]; // 빈 배열이면 1장 빈 카드
  template?: TemplateName;
  body?: string; // 본문 = 캡션 = 발행 기록(content)
  batchId?: string;
};

export async function publishToInstagram({
  cards,
  template = "minimal-white",
  body,
  batchId,
}: InstagramInput): Promise<MediaResult> {
  const user = await requireUser();
  const supabase = createClient();

  const result = await publishInstagramForUser({
    supabase,
    userId: user.id,
    cards,
    template,
    body,
    batchId,
  });
  if (!result.error) revalidatePath("/history");
  return result;
}

// ─── Multi-channel ──────────────────────────────────────────────────────────

export async function publishMulti(
  input: MultiPublishInput
): Promise<{ results: ChannelResult[] }> {
  const user = await requireUser();
  const supabase = createClient();

  const { results } = await publishMultiForUser({
    supabase,
    userId: user.id,
    input,
  });

  if (results.some((r) => r.success)) revalidatePath("/history");
  return { results };
}

// ─── 예약 발행 ──────────────────────────────────────────────────────────────

export type ScheduleResult = {
  ok: boolean;
  id?: string;
  scheduledAt?: string;
  error?: string;
};

/**
 * 예약 발행 등록 — 발행 내용 전체를 scheduled_posts.payload 에 저장하고
 * pg_cron(또는 Vercel Cron)이 /api/cron/publish 로 시각에 집어가 발행한다.
 */
export async function schedulePost(
  input: MultiPublishInput & { scheduledAt: string }
): Promise<ScheduleResult> {
  const invalid = validateMultiPublishInput(input);
  if (invalid) return { ok: false, error: invalid };

  const at = parseScheduledAt(input.scheduledAt);
  if (!at.ok) return { ok: false, error: at.error };

  const user = await requireUser();
  const supabase = createClient();

  const result = await schedulePostForUser({
    supabase,
    userId: user.id,
    scheduledAt: at.iso,
    input: {
      channels: input.channels,
      body: input.body,
      instagramCards: input.instagramCards,
      instagramTemplate: input.instagramTemplate,
      reddit: input.reddit,
      channelContents: input.channelContents,
    },
  });

  if (result.ok) revalidatePath("/history");
  return result;
}
