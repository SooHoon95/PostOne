/**
 * AI 채널별 톤·형식 변환 도메인 타입과 상수.
 *
 * 채널 모듈(lib/linkedin, lib/threads, lib/instagram, lib/reddit)은 import하지 않는다.
 * 이 모듈은 fetch·타입에만 의존하는 공유 도메인이다. 각 채널의 글자수 상한은
 * 플랫폼 제약을 이 모듈에 독립적으로 적어 둔 값이며, 클라이언트 컴포넌트에서도
 * import할 수 있도록 순수 상수/타입만 둔다.
 */

export const AI_CHANNELS = [
  "linkedin",
  "threads",
  "instagram",
  "reddit",
  "peerlist",
] as const;

export type AIChannel = (typeof AI_CHANNELS)[number];

export const AI_LANGUAGES = ["ko", "en", "auto"] as const;

export type AILanguage = (typeof AI_LANGUAGES)[number];

/** 초안 원문 상한 — 너무 긴 입력은 토큰 비용과 응답 잘림을 만든다. */
export const SOURCE_TEXT_MAX = 20000;

/**
 * 채널별 글자수 제한.
 * linkedin/threads/instagram/reddit 값은 각 플랫폼의 발행 상한과 같다.
 * peerlist는 아직 API 발행이 없어(3단계 크롬 익스텐션) 짧은 글을 목표로 둔 제품 가드다.
 */
export const CHANNEL_LIMITS = {
  linkedin: { content: 3000 },
  threads: { content: 500 },
  peerlist: { content: 700 },
  instagram: {
    caption: 2200,
    cardTitle: 60,
    slidesMin: 3,
    slidesMax: 6,
    slideTitle: 40,
    slideDescription: 220,
  },
  reddit: { title: 300, content: 40000 },
} as const;

export type TextAdapt = { content: string };

/** Instagram: 캡션 + 캐러셀 카드(Satori 카드 생성기 입력) */
export type InstagramSlide = { title: string; description: string };

export type InstagramAdapt = {
  caption: string;
  cardTitle: string;
  slides: InstagramSlide[];
};

export type RedditAdapt = { title: string; content: string };

export type AdaptedChannelContent = {
  linkedin: TextAdapt;
  threads: TextAdapt;
  instagram: InstagramAdapt;
  reddit: RedditAdapt;
  peerlist: TextAdapt;
};

export type AdaptRequest = {
  sourceText: string;
  channels: AIChannel[];
  /** Reddit 톤 힌트 (r/ 제외, 소문자 서브레딧 이름) */
  subreddit?: string;
  language: AILanguage;
};

export type AdaptResult = {
  provider: "anthropic" | "openai";
  model: string;
  channels: Partial<AdaptedChannelContent>;
  warnings: string[];
};

export type AdaptRequestError = { ok: false; error: string; field?: string };
export type AdaptRequestOk = { ok: true; value: AdaptRequest };

const SUBREDDIT_PATTERN = /^[A-Za-z0-9_]{2,21}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAIChannel(value: unknown): value is AIChannel {
  return (
    typeof value === "string" &&
    (AI_CHANNELS as readonly string[]).includes(value)
  );
}

/** "r/iosdev" · "/r/iosdev" 같은 표기를 서브레딧 이름만 남긴다. */
export function normalizeSubredditHint(value: string): string {
  return value
    .trim()
    .replace(/^\/?r\//i, "")
    .replace(/^\/+/, "")
    .trim();
}

/**
 * API 요청 본문 검증. 라우트는 이 결과만 보고 상태코드를 정한다.
 * 채널 순서는 요청 순서를 유지하고 중복만 제거한다(프롬프트·응답 키 순서 안정).
 */
export function parseAdaptRequest(
  input: unknown
): AdaptRequestOk | AdaptRequestError {
  if (!isRecord(input)) {
    return { ok: false, error: "요청 본문이 올바르지 않습니다.", field: "body" };
  }

  const sourceText =
    typeof input.sourceText === "string" ? input.sourceText.trim() : "";
  if (!sourceText) {
    return { ok: false, error: "sourceText는 필수입니다.", field: "sourceText" };
  }
  if (sourceText.length > SOURCE_TEXT_MAX) {
    return {
      ok: false,
      error: `sourceText는 최대 ${SOURCE_TEXT_MAX}자입니다.`,
      field: "sourceText",
    };
  }

  if (!Array.isArray(input.channels)) {
    return {
      ok: false,
      error: "channels는 배열이어야 합니다.",
      field: "channels",
    };
  }
  const channels: AIChannel[] = [];
  for (const raw of input.channels) {
    if (!isAIChannel(raw)) {
      return {
        ok: false,
        error: `지원하지 않는 채널입니다: ${String(raw)}`,
        field: "channels",
      };
    }
    if (!channels.includes(raw)) channels.push(raw);
  }
  if (channels.length === 0) {
    return {
      ok: false,
      error: "channels를 1개 이상 선택하세요.",
      field: "channels",
    };
  }

  const language = input.language === undefined ? "auto" : input.language;
  if (
    typeof language !== "string" ||
    !(AI_LANGUAGES as readonly string[]).includes(language)
  ) {
    return {
      ok: false,
      error: "language는 ko · en · auto 중 하나입니다.",
      field: "language",
    };
  }

  let subreddit: string | undefined;
  if (input.subreddit !== undefined && input.subreddit !== null) {
    if (typeof input.subreddit !== "string") {
      return {
        ok: false,
        error: "subreddit는 문자열이어야 합니다.",
        field: "subreddit",
      };
    }
    const hint = normalizeSubredditHint(input.subreddit);
    if (hint) {
      if (!SUBREDDIT_PATTERN.test(hint)) {
        return {
          ok: false,
          error: "서브레딧 이름이 올바르지 않습니다 (영문·숫자·밑줄 2~21자).",
          field: "subreddit",
        };
      }
      subreddit = hint;
    }
  }

  return {
    ok: true,
    value: {
      sourceText,
      channels,
      subreddit,
      language: language as AILanguage,
    },
  };
}
