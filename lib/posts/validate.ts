import type { Channel, MultiPublishInput } from "./types";
import { isValidSubreddit, normalizeSubreddit } from "@/lib/reddit/subreddit";

/**
 * 발행 전 검증 — 즉시 발행(서버 액션)과 예약 발행(예약 등록·cron 실행)이
 * 같은 규칙을 쓰도록 한곳에 모은 순수 모듈.
 */

export const LINKEDIN_MAX = 3000;
export const THREADS_MAX = 500;
export const INSTAGRAM_MAX = 2200;
export const REDDIT_TITLE_MAX = 300;
export const INSTAGRAM_CARD_MAX = 10;

/** 채널별 실제 발행 본문 — 맞춤 본문(AI 변환) 우선, 없으면 공통 body. */
export function contentForChannel(
  input: MultiPublishInput,
  channel: Channel
): string {
  const override = input.channelContents?.[channel];
  const tailored = typeof override === "string" ? override.trim() : "";
  return tailored || input.body;
}

export function validateLinkedInContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return "내용을 입력해주세요.";
  if (trimmed.length > LINKEDIN_MAX) {
    return `LinkedIn은 최대 ${LINKEDIN_MAX}자까지 가능합니다.`;
  }
  return null;
}

export function validateThreadsContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return "내용을 입력해주세요.";
  if (trimmed.length > THREADS_MAX) {
    return `Threads는 최대 ${THREADS_MAX}자까지 가능합니다.`;
  }
  return null;
}

export type RedditValidation = {
  subreddit: string;
  title: string;
  link: string;
  error?: string;
};

/** 서브레딧/제목/링크 정규화 + 검증 (링크 글은 본문 없이 가능). */
export function validateRedditInput(input: {
  subreddit: string;
  title: string;
  link?: string;
  body: string;
}): RedditValidation {
  const subreddit = normalizeSubreddit(input.subreddit ?? "");
  const title = (input.title ?? "").trim();
  const link = (input.link ?? "").trim();
  const body = input.body.trim();

  const fail = (error: string): RedditValidation => ({
    subreddit,
    title,
    link,
    error,
  });

  if (!subreddit) return fail("서브레딧을 입력하세요.");
  if (!isValidSubreddit(subreddit)) {
    return fail("서브레딧 이름이 올바르지 않습니다 (영문·숫자·밑줄 2~21자).");
  }
  if (!title) return fail("Reddit 제목을 입력하세요.");
  if (title.length > REDDIT_TITLE_MAX) {
    return fail(`Reddit 제목은 최대 ${REDDIT_TITLE_MAX}자입니다.`);
  }
  if (!link && !body) return fail("본문 또는 링크를 입력하세요.");
  if (link && !/^https?:\/\//i.test(link)) {
    return fail("링크는 http(s)://로 시작해야 합니다.");
  }

  return { subreddit, title, link };
}

/**
 * 멀티 채널 발행 입력 전체 검증. 문제가 없으면 null.
 * 예약 등록 시점에 한 번, cron 이 실제 발행하기 직전에 한 번 더 확인한다.
 */
export function validateMultiPublishInput(
  input: MultiPublishInput
): string | null {
  const channels = input.channels ?? [];
  if (channels.length === 0) return "채널을 1개 이상 선택하세요.";

  const seen = new Set<Channel>();
  for (const channel of channels) {
    if (seen.has(channel)) continue;
    seen.add(channel);

    if (channel === "linkedin") {
      const error = validateLinkedInContent(contentForChannel(input, "linkedin"));
      if (error) return error;
    } else if (channel === "threads") {
      const error = validateThreadsContent(contentForChannel(input, "threads"));
      if (error) return error;
    } else if (channel === "instagram") {
      const caption = contentForChannel(input, "instagram").trim();
      if (!caption) return "Instagram 캡션(본문)을 입력해주세요.";
      if (caption.length > INSTAGRAM_MAX) {
        return `Instagram은 최대 ${INSTAGRAM_MAX}자까지 가능합니다.`;
      }
      if ((input.instagramCards?.length ?? 0) > INSTAGRAM_CARD_MAX) {
        return `Instagram 카드는 최대 ${INSTAGRAM_CARD_MAX}장입니다.`;
      }
    } else if (channel === "reddit") {
      const error = validateRedditInput({
        subreddit: input.reddit?.subreddit ?? "",
        title: input.reddit?.title ?? "",
        link: input.reddit?.link,
        body: contentForChannel(input, "reddit"),
      }).error;
      if (error) return error;
    }
  }

  return null;
}
