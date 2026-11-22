/**
 * AI 채널별 변환 실행기.
 *
 * - 외부 SDK 없이 표준 fetch만 쓴다(Vercel 함수 번들·의존성 최소화).
 * - ANTHROPIC_API_KEY가 있으면 Claude, 없고 OPENAI_API_KEY가 있으면 OpenAI.
 *   둘 다 없으면 AiNotConfiguredError — 라우트가 503으로 변환한다.
 * - 모델 출력은 신뢰하지 않는다: JSON 추출 → 채널별 구조 검증 → 길이 상한 클램프.
 */
import { buildAdaptMessages } from "./prompts";
import {
  CHANNEL_LIMITS,
  isRecord,
  type AdaptRequest,
  type AdaptResult,
  type AdaptedChannelContent,
  type AIChannel,
  type InstagramSlide,
} from "./types";

export type AiProvider = "anthropic" | "openai";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
};

export class AiNotConfiguredError extends Error {
  constructor(message = "AI 프로바이더 키가 설정되지 않았습니다.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export class AiRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiRequestError";
    this.status = status;
  }
}

export class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiParseError";
  }
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** 기본 모델 — 운영에서 모델을 바꾸려면 ANTHROPIC_MODEL / OPENAI_MODEL을 설정한다. */
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/** 5채널 + 캐러셀 슬라이드까지 들어가는 응답 길이 (한국어는 글자당 토큰이 커서 넉넉히) */
const MAX_OUTPUT_TOKENS = 8192;

const REQUEST_TIMEOUT_MS = 55_000;

type EnvLike = Record<string, string | undefined>;

export function resolveAiConfig(env: EnvLike = process.env): AiConfig {
  const anthropicKey = env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return {
      provider: "anthropic",
      apiKey: anthropicKey,
      model: env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
    };
  }
  const openaiKey = env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    };
  }
  throw new AiNotConfiguredError();
}

export function isAiConfigured(env: EnvLike = process.env): boolean {
  return Boolean(
    env.ANTHROPIC_API_KEY?.trim() || env.OPENAI_API_KEY?.trim()
  );
}

/** 모델이 코드펜스나 앞말을 붙여도 첫 JSON 객체를 꺼낸다. */
export function extractJsonObject(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new AiParseError("AI 응답에서 JSON을 찾지 못했습니다.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AiParseError("AI 응답 JSON 파싱에 실패했습니다.");
  }
  if (!isRecord(parsed)) {
    throw new AiParseError("AI 응답이 JSON 객체가 아닙니다.");
  }
  return parsed;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 길이 상한 클램프. 모델이 상한을 넘겨도 발행 단계에서 실패하지 않도록
 * 가능하면 문장/단어 경계에서 자른다.
 */
export function clampText(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const sentenceEnd = Math.max(
    window.lastIndexOf("다."),
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf("\n")
  );
  // 너무 앞에서 끊기면(절반 미만) 그냥 상한에서 자른다.
  if (sentenceEnd > max / 2) {
    return window.slice(0, sentenceEnd + 1).trim();
  }
  return window.trimEnd();
}

function normalizeSlides(value: unknown): InstagramSlide[] {
  if (!Array.isArray(value)) return [];
  const slides: InstagramSlide[] = [];
  for (const item of value.slice(0, CHANNEL_LIMITS.instagram.slidesMax)) {
    if (!isRecord(item)) continue;
    const title = clampText(
      asText(item.title),
      CHANNEL_LIMITS.instagram.slideTitle
    );
    const description = clampText(
      asText(item.description),
      CHANNEL_LIMITS.instagram.slideDescription
    );
    if (!title && !description) continue;
    slides.push({ title, description });
  }
  return slides;
}

function parseTextChannel(
  value: Record<string, unknown>,
  max: number,
  label: string,
  warnings: string[]
): { content: string } | null {
  const raw = asText(value.content);
  if (!raw) {
    warnings.push(`${label}: 본문이 비어 있어 제외`);
    return null;
  }
  const content = clampText(raw, max);
  if (content.length < raw.length) {
    warnings.push(`${label}: ${max}자로 줄임`);
  }
  return { content };
}

function parseInstagram(
  value: Record<string, unknown>,
  warnings: string[]
): AdaptedChannelContent["instagram"] | null {
  const rawCaption = asText(value.caption);
  const caption = clampText(rawCaption, CHANNEL_LIMITS.instagram.caption);
  const cardTitle = clampText(
    asText(value.cardTitle),
    CHANNEL_LIMITS.instagram.cardTitle
  );
  const slides = normalizeSlides(value.slides);

  if (!caption && slides.length === 0) {
    warnings.push("instagram: 캡션·슬라이드가 비어 있어 제외");
    return null;
  }
  if (rawCaption.length > caption.length) {
    warnings.push(`instagram: 캡션을 ${CHANNEL_LIMITS.instagram.caption}자로 줄임`);
  }
  if (slides.length < CHANNEL_LIMITS.instagram.slidesMin) {
    warnings.push(
      `instagram: 슬라이드 ${CHANNEL_LIMITS.instagram.slidesMin}장 미만 (${slides.length}장)`
    );
  }
  return { caption, cardTitle, slides };
}

function parseReddit(
  value: Record<string, unknown>,
  warnings: string[]
): AdaptedChannelContent["reddit"] | null {
  const rawTitle = asText(value.title);
  const rawContent = asText(value.content);
  if (!rawTitle || !rawContent) {
    warnings.push("reddit: 제목 또는 본문이 비어 있어 제외");
    return null;
  }
  const title = clampText(rawTitle, CHANNEL_LIMITS.reddit.title);
  const content = clampText(rawContent, CHANNEL_LIMITS.reddit.content);
  if (title.length < rawTitle.length) {
    warnings.push(`reddit: 제목을 ${CHANNEL_LIMITS.reddit.title}자로 줄임`);
  }
  return { title, content };
}

/**
 * 모델 원문 텍스트 → 채널별 결과. 구조가 어긋난 채널은 경고와 함께 제외하고,
 * 쓸 수 있는 채널이 하나도 없으면 AiParseError.
 */
export function parseAdaptOutput(
  raw: string,
  channels: AIChannel[]
): { channels: Partial<AdaptedChannelContent>; warnings: string[] } {
  const parsed = extractJsonObject(raw);
  const root = isRecord(parsed.channels) ? parsed.channels : parsed;

  const out: Partial<AdaptedChannelContent> = {};
  const warnings: string[] = [];

  for (const channel of channels) {
    const value = isRecord(root) ? root[channel] : undefined;
    if (!isRecord(value)) {
      warnings.push(`${channel}: 변환 결과 없음`);
      continue;
    }
    switch (channel) {
      case "linkedin": {
        const parsedChannel = parseTextChannel(
          value,
          CHANNEL_LIMITS.linkedin.content,
          "linkedin",
          warnings
        );
        if (parsedChannel) out.linkedin = parsedChannel;
        break;
      }
      case "threads": {
        const parsedChannel = parseTextChannel(
          value,
          CHANNEL_LIMITS.threads.content,
          "threads",
          warnings
        );
        if (parsedChannel) out.threads = parsedChannel;
        break;
      }
      case "peerlist": {
        const parsedChannel = parseTextChannel(
          value,
          CHANNEL_LIMITS.peerlist.content,
          "peerlist",
          warnings
        );
        if (parsedChannel) out.peerlist = parsedChannel;
        break;
      }
      case "instagram": {
        const parsedChannel = parseInstagram(value, warnings);
        if (parsedChannel) out.instagram = parsedChannel;
        break;
      }
      case "reddit": {
        const parsedChannel = parseReddit(value, warnings);
        if (parsedChannel) out.reddit = parsedChannel;
        break;
      }
    }
  }

  if (Object.keys(out).length === 0) {
    throw new AiParseError("AI 응답에 사용할 수 있는 채널 결과가 없습니다.");
  }

  return { channels: out, warnings };
}

function timeoutSignal(): AbortSignal | undefined {
  const signalCtor = globalThis.AbortSignal as
    | (typeof AbortSignal & { timeout?: (ms: number) => AbortSignal })
    | undefined;
  if (signalCtor && typeof signalCtor.timeout === "function") {
    return signalCtor.timeout(REQUEST_TIMEOUT_MS);
  }
  return undefined;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function providerErrorMessage(data: unknown): string | null {
  if (isRecord(data) && isRecord(data.error)) {
    const message = asText(data.error.message);
    if (message) return message;
  }
  return null;
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  fetchImpl: typeof fetch
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: timeoutSignal(),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new AiRequestError("AI 응답 시간이 초과되었습니다.");
    }
    throw new AiRequestError(
      e instanceof Error ? e.message : "AI 요청에 실패했습니다."
    );
  }

  const data = await readJson(res);
  if (!res.ok) {
    const message = providerErrorMessage(data) ?? `AI API 오류 (${res.status})`;
    throw new AiRequestError(message, res.status);
  }
  return data;
}

async function callAnthropic(
  config: AiConfig,
  messages: { system: string; user: string },
  fetchImpl: typeof fetch
): Promise<string> {
  const data = await postJson(
    ANTHROPIC_URL,
    {
      "x-api-key": config.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    {
      model: config.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.6,
      system: messages.system,
      messages: [{ role: "user", content: messages.user }],
    },
    fetchImpl
  );

  if (!isRecord(data) || !Array.isArray(data.content)) {
    throw new AiParseError("AI 응답 형식이 올바르지 않습니다.");
  }
  const text = data.content
    .map((block) =>
      isRecord(block) && block.type === "text" ? asText(block.text) : ""
    )
    .filter(Boolean)
    .join("\n");
  if (!text) throw new AiParseError("AI 응답이 비어 있습니다.");
  return text;
}

async function callOpenAI(
  config: AiConfig,
  messages: { system: string; user: string },
  fetchImpl: typeof fetch
): Promise<string> {
  const data = await postJson(
    OPENAI_URL,
    { authorization: `Bearer ${config.apiKey}` },
    {
      model: config.model,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user },
      ],
    },
    fetchImpl
  );

  if (!isRecord(data) || !Array.isArray(data.choices)) {
    throw new AiParseError("AI 응답 형식이 올바르지 않습니다.");
  }
  const first = data.choices[0];
  const content = isRecord(first) && isRecord(first.message)
    ? asText(first.message.content)
    : "";
  if (!content) throw new AiParseError("AI 응답이 비어 있습니다.");
  return content;
}

export type AdaptDeps = {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
};

/** 초안 1건 → 요청한 채널들의 톤·형식 변환 결과. */
export async function adaptContent(
  request: AdaptRequest,
  deps: AdaptDeps = {}
): Promise<AdaptResult> {
  const config = resolveAiConfig(deps.env ?? process.env);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const messages = buildAdaptMessages(request);

  const raw =
    config.provider === "anthropic"
      ? await callAnthropic(config, messages, fetchImpl)
      : await callOpenAI(config, messages, fetchImpl);

  const { channels, warnings } = parseAdaptOutput(raw, request.channels);

  return {
    provider: config.provider,
    model: config.model,
    channels,
    warnings,
  };
}
