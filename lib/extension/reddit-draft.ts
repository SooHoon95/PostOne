import { CHANNEL_LIMITS } from "@/lib/ai/types";

/**
 * Reddit 초안 계약 (웹 ↔ 크롬 익스텐션).
 *
 * Reddit은 공개 발행 API 승인이 막혀 있는 동안에도 사용자가 직접 게시할 수 있도록,
 * 확장이 reddit.com 글쓰기 창(submit)에 제목·본문을 채워 준다.
 * 확장 쪽 구현은 순수 JS라 이 모듈을 import할 수 없으므로 값은 양쪽에 같게 적는다
 * (tests/reddit-bridge 참고). 게시 버튼 클릭은 절대 자동화하지 않는다.
 */

/** chrome.storage.local 키 — extension/background.js와 같은 값 */
export const REDDIT_DRAFT_STORAGE_KEY = "redditDraft";

/** 배경 → content-reddit.js 채우기 메시지 */
export const REDDIT_FILL_MESSAGE = "POSTONE_REDDIT_FILL";

export const REDDIT_ORIGIN = "https://www.reddit.com";

export const REDDIT_TITLE_MAX = CHANNEL_LIMITS.reddit.title;
export const REDDIT_BODY_MAX = CHANNEL_LIMITS.reddit.content;

const SUBREDDIT_RE = /^[A-Za-z0-9_]{2,21}$/;

/** 게시판 힌트 — r/ 접두어를 떼고 공백을 제거한다. */
export function normalizeRedditSubreddit(input: string | undefined | null): string {
  return String(input ?? "")
    .trim()
    .replace(/^\/?r\//i, "")
    .trim();
}

export function isValidRedditSubreddit(input: string | undefined | null): boolean {
  return SUBREDDIT_RE.test(normalizeRedditSubreddit(input));
}

/** 글쓰기 창 주소 — 힌트가 유효하면 r/<sub>/submit, 아니면 커뮤니티 선택 화면. */
export function redditSubmitUrl(subreddit?: string): string {
  const sub = normalizeRedditSubreddit(subreddit);
  if (sub && SUBREDDIT_RE.test(sub)) {
    return `${REDDIT_ORIGIN}/r/${sub}/submit`;
  }
  return `${REDDIT_ORIGIN}/submit`;
}

/** 이미 열린 Reddit 글쓰기 탭을 찾을 때 쓰는 URL 패턴 */
export const REDDIT_SUBMIT_URL_PATTERNS = [
  `${REDDIT_ORIGIN}/submit*`,
  `${REDDIT_ORIGIN}/r/*/submit*`,
];

export type RedditExtensionDraft = {
  subreddit: string;
  title: string;
  body: string;
  updatedAt: string;
};

export type RedditDraftInput = {
  subreddit?: string;
  title: string;
  body: string;
};

export type RedditDraftValidation =
  | { ok: true; draft: RedditDraftInput }
  | { ok: false; message: string };

/** 웹에서 보내기 전 검증 — 제목·본문 필수, 길이·서브레딧 형식 확인. */
export function validateRedditDraftInput(
  input: RedditDraftInput
): RedditDraftValidation {
  const title = (input.title ?? "").trim();
  const body = (input.body ?? "").trim();
  const subreddit = normalizeRedditSubreddit(input.subreddit);

  if (!title) return { ok: false, message: "Reddit 제목이 비어 있습니다." };
  if (title.length > REDDIT_TITLE_MAX) {
    return { ok: false, message: `Reddit 제목은 최대 ${REDDIT_TITLE_MAX}자입니다.` };
  }
  if (!body) return { ok: false, message: "Reddit 본문이 비어 있습니다." };
  if (body.length > REDDIT_BODY_MAX) {
    return { ok: false, message: `Reddit 본문은 최대 ${REDDIT_BODY_MAX}자입니다.` };
  }
  if (subreddit && !SUBREDDIT_RE.test(subreddit)) {
    return {
      ok: false,
      message: "서브레딧 이름이 올바르지 않습니다 (영문·숫자·밑줄 2~21자).",
    };
  }

  return { ok: true, draft: { subreddit, title, body } };
}
