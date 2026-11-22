/**
 * AI 채널별 변환 프롬프트 빌더.
 *
 * 프롬프트는 순수 문자열 조립만 한다(네트워크·env 접근 없음) — 단위 테스트가
 * "어떤 지시가 모델에 들어가는지"를 직접 검증할 수 있게 하기 위해서다.
 */
import {
  CHANNEL_LIMITS,
  type AdaptRequest,
  type AIChannel,
  type AILanguage,
} from "./types";

const LANGUAGE_RULE: Record<AILanguage, string> = {
  ko: "Write every field in Korean (한국어). Keep product and brand names as they appear in the source.",
  en: "Write every field in English. Keep product and brand names as they appear in the source.",
  auto: "Write in the same language as the source draft. If it mixes languages, follow the dominant one. Keep product and brand names as they appear in the source.",
};

const SHARED_RULES = [
  "You adapt ONE source draft into channel-specific posts for a multi-channel publishing tool.",
  "",
  "Rules:",
  "- Stay faithful to the source. Never invent metrics, users, revenue, awards, customers, quotes, or links.",
  "- Keep every number, date, and name exactly as written in the source.",
  "- No markdown headings, no bullet lists unless the channel guidance asks for them, no code fences.",
  "- No filler openers such as \"I'm thrilled to share\" or \"오늘은 ~에 대해 이야기해보겠습니다\".",
  "- Each channel must read like a native post on that platform, not a reformatted copy of the source.",
  "- Respond with a single JSON object and nothing else — no prose before or after, no code fences.",
].join("\n");

/** 카드에 84-96px로 렌더링되는 슬라이드 제목의 한국어 권장 길이 */
const KOREAN_SLIDE_TITLE_GUIDE = 18;

export const CHANNEL_GUIDANCE: Record<AIChannel, string> = {
  linkedin: [
    `Shape: {"content": string} — max ${CHANNEL_LIMITS.linkedin.content} characters.`,
    "Tone: professional, insight-driven, first person.",
    "- First line is a hook that states the result or the lesson; no greeting.",
    "- Short paragraphs of 1-2 lines with a blank line between them.",
    "- One concrete takeaway the reader can apply, then a soft closing question.",
    "- 0-3 relevant hashtags at the very end. At most 2 emoji.",
  ].join("\n"),
  threads: [
    `Shape: {"content": string} — max ${CHANNEL_LIMITS.threads.content} characters.`,
    "Tone: punchy, conversational, spoken Korean/English.",
    "- Open with a hook of one short sentence that makes people stop scrolling.",
    "- One idea only. Short lines, at most 2 emoji, 0-2 hashtags.",
    "- End with a question or a sharp one-liner, not a summary.",
  ].join("\n"),
  instagram: [
    `Shape: {"caption": string, "cardTitle": string, "slides": [{"title": string, "description": string}]}`,
    `- caption: max ${CHANNEL_LIMITS.instagram.caption} characters. Story-driven, line breaks for breathing room, 3-6 hashtags at the end.`,
    `- cardTitle: max ${CHANNEL_LIMITS.instagram.cardTitle} characters. Cover title for the carousel.`,
    `- slides: ${CHANNEL_LIMITS.instagram.slidesMin}-${CHANNEL_LIMITS.instagram.slidesMax} items. Slide 1 is the hook, the last slide is a call to action (save/share/follow).`,
    `- Each slide title: max ${KOREAN_SLIDE_TITLE_GUIDE} Korean characters (about ${CHANNEL_LIMITS.instagram.slideTitle} Latin characters), no trailing period.`,
    `- Each slide description: max ${CHANNEL_LIMITS.instagram.slideDescription} characters, one point per slide, readable on a 1080x1080 card without the caption.`,
    "- Never reference other slides (\"위에서 말한\", \"as mentioned above\") — each card stands alone.",
  ].join("\n"),
  reddit: [
    `Shape: {"title": string, "content": string} — title max ${CHANNEL_LIMITS.reddit.title} characters, body max ${CHANNEL_LIMITS.reddit.content} characters.`,
    "Tone: a real person telling a story to peers. Reddit readers reject marketing.",
    "- Title: specific and plain, no clickbait, no emoji, no hashtags.",
    "- Body: first person, concrete details, what you built and what went wrong, numbers only from the source.",
    "- No call to action, no links unless the source has one, no self-promotion phrasing.",
    "- End by asking for feedback or advice, in one plain sentence.",
  ].join("\n"),
  peerlist: [
    `Shape: {"content": string} — max ${CHANNEL_LIMITS.peerlist.content} characters.`,
    "Tone: indie maker shipping in public (#buildinpublic / #show).",
    "- What shipped, one lesson or number, what is next.",
    "- Plain short lines, at most 1 emoji, 1-3 tags from #buildinpublic, #show, #indiehackers.",
    "- No marketing adjectives, no call to buy.",
  ].join("\n"),
};

export function buildSystemPrompt(language: AILanguage = "auto"): string {
  return [SHARED_RULES, "", `Language: ${LANGUAGE_RULE[language]}`].join("\n");
}

/** 요청된 채널의 JSON 형태·길이 제한을 출력 계약으로 명시한다. */
export function buildOutputContract(channels: AIChannel[]): string {
  const lines = [
    "Output contract:",
    '{"channels": { "<channel>": { ... } }}',
    "Include exactly these channel keys and nothing else:",
  ];
  for (const channel of channels) {
    lines.push(`- ${channel}`);
  }
  lines.push(
    `- instagram.slides must contain ${CHANNEL_LIMITS.instagram.slidesMin}-${CHANNEL_LIMITS.instagram.slidesMax} items.`,
    "- Any string that would exceed a limit must be shortened, never cut mid-word."
  );
  return lines.join("\n");
}

export function buildUserPrompt(request: AdaptRequest): string {
  const blocks = [
    "# Source draft",
    '"""',
    request.sourceText,
    '"""',
    "",
    "# Target channels",
  ];

  for (const channel of request.channels) {
    blocks.push(`## ${channel}`, CHANNEL_GUIDANCE[channel], "");
  }

  if (request.subreddit && request.channels.includes("reddit")) {
    blocks.push(
      `# Reddit audience`,
      `The post goes to r/${request.subreddit}. Match that community's conventions and vocabulary; if the source does not fit the community, keep it honest and non-promotional rather than forcing it.`,
      ""
    );
  }

  blocks.push(buildOutputContract(request.channels));
  return blocks.join("\n");
}

export function buildAdaptMessages(request: AdaptRequest): {
  system: string;
  user: string;
} {
  return {
    system: buildSystemPrompt(request.language),
    user: buildUserPrompt(request),
  };
}
