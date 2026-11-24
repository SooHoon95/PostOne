import { describe, it, expect, vi } from "vitest";
import {
  adaptContent,
  AiNotConfiguredError,
  AiParseError,
  AiRequestError,
  clampText,
  extractJsonObject,
  isAiConfigured,
  parseAdaptOutput,
  resolveAiConfig,
} from "@/lib/ai/adapt";
import { CHANNEL_LIMITS, type AdaptRequest } from "@/lib/ai/types";

const request: AdaptRequest = {
  sourceText: "뮤터 앱을 출시했다.",
  channels: ["linkedin", "peerlist"],
  language: "ko",
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function anthropicResponse(payload: unknown) {
  return jsonResponse({
    content: [{ type: "text", text: JSON.stringify(payload) }],
  });
}

describe("resolveAiConfig / isAiConfigured", () => {
  it("throws a clear error when neither key is set", () => {
    expect(() => resolveAiConfig({})).toThrow(AiNotConfiguredError);
    expect(isAiConfigured({})).toBe(false);
  });

  it("prefers Claude and falls back to OpenAI", () => {
    expect(
      resolveAiConfig({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "b" }).provider
    ).toBe("anthropic");
    const openai = resolveAiConfig({ OPENAI_API_KEY: "b" });
    expect(openai.provider).toBe("openai");
    expect(openai.model).toBe("gpt-4o-mini");
  });

  it("honours model overrides", () => {
    const config = resolveAiConfig({
      ANTHROPIC_API_KEY: "a",
      ANTHROPIC_MODEL: "claude-custom",
    });
    expect(config.model).toBe("claude-custom");
  });

  it("falls back to Gemini when only that key exists", () => {
    const gemini = resolveAiConfig({ GEMINI_API_KEY: "g-test" });
    expect(gemini.provider).toBe("gemini");
    expect(gemini.model).toBe("gemini-3.8-flash");
    expect(isAiConfigured({ GEMINI_API_KEY: "g-test" })).toBe(true);
  });

  it("keeps the documented provider order", () => {
    expect(
      resolveAiConfig({
        ANTHROPIC_API_KEY: "a",
        OPENAI_API_KEY: "b",
        GEMINI_API_KEY: "c",
      }).provider
    ).toBe("anthropic");
    expect(
      resolveAiConfig({ OPENAI_API_KEY: "b", GEMINI_API_KEY: "c" }).provider
    ).toBe("openai");
  });

  it("honours GEMINI_MODEL and AI_PROVIDER", () => {
    expect(
      resolveAiConfig({
        GEMINI_API_KEY: "g",
        GEMINI_MODEL: "gemini-3.5-flash-lite",
      }).model
    ).toBe("gemini-3.5-flash-lite");

    const forced = resolveAiConfig({
      AI_PROVIDER: "gemini",
      ANTHROPIC_API_KEY: "a",
      GEMINI_API_KEY: "g",
    });
    expect(forced.provider).toBe("gemini");
    expect(forced.model).toBe("gemini-3.8-flash");
  });

  it("refuses when AI_PROVIDER names a provider without a key", () => {
    expect(isAiConfigured({ AI_PROVIDER: "gemini", OPENAI_API_KEY: "b" })).toBe(
      false
    );
    expect(() =>
      resolveAiConfig({ AI_PROVIDER: "gemini", OPENAI_API_KEY: "b" })
    ).toThrow(/GEMINI_API_KEY/);
  });

  it("ignores blank keys", () => {
    expect(isAiConfigured({ ANTHROPIC_API_KEY: "   " })).toBe(false);
  });
});

describe("extractJsonObject", () => {
  it("reads fenced JSON", () => {
    const parsed = extractJsonObject('```json\n{"channels":{}}\n```');
    expect(parsed).toEqual({ channels: {} });
  });

  it("ignores leading prose", () => {
    const parsed = extractJsonObject('Sure!\n{"a":1}\nDone.');
    expect(parsed).toEqual({ a: 1 });
  });

  it("throws AiParseError on garbage", () => {
    expect(() => extractJsonObject("no json here")).toThrow(AiParseError);
    expect(() => extractJsonObject("{broken")).toThrow(AiParseError);
  });
});

describe("clampText", () => {
  it("keeps short text untouched", () => {
    expect(clampText("  hello  ", 10)).toBe("hello");
  });

  it("cuts on a sentence boundary when possible", () => {
    const text = "첫 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다.";
    const clamped = clampText(text, 24);
    expect(clamped.length).toBeLessThanOrEqual(24);
    expect(clamped.endsWith("다.")).toBe(true);
  });

  it("hard-cuts when no boundary is available", () => {
    expect(clampText("a".repeat(50), 30)).toHaveLength(30);
  });
});

describe("parseAdaptOutput", () => {
  it("parses text channels and clamps over-length content", () => {
    const long = "가".repeat(CHANNEL_LIMITS.linkedin.content + 200);
    const { channels, warnings } = parseAdaptOutput(
      JSON.stringify({
        channels: {
          linkedin: { content: long },
          peerlist: { content: "짧은 인디 메이커 글 #buildinpublic" },
        },
      }),
      ["linkedin", "peerlist"]
    );

    expect(channels.linkedin?.content).toHaveLength(
      CHANNEL_LIMITS.linkedin.content
    );
    expect(channels.peerlist?.content).toContain("#buildinpublic");
    expect(warnings.join(" ")).toMatch(/linkedin/);
  });

  it("parses Instagram caption + slides and caps slide count", () => {
    const slides = Array.from({ length: 8 }, (_, i) => ({
      title: `슬라이드 ${i + 1}`,
      description: "카드 설명",
    }));
    const { channels } = parseAdaptOutput(
      JSON.stringify({
        instagram: {
          caption: "캡션",
          cardTitle: "표지",
          slides,
        },
      }),
      ["instagram"]
    );

    expect(channels.instagram?.caption).toBe("캡션");
    expect(channels.instagram?.cardTitle).toBe("표지");
    expect(channels.instagram?.slides).toHaveLength(
      CHANNEL_LIMITS.instagram.slidesMax
    );
  });

  it("warns when slides fall short of the minimum", () => {
    const { channels, warnings } = parseAdaptOutput(
      JSON.stringify({
        channels: {
          instagram: {
            caption: "캡션",
            slides: [{ title: "하나", description: "설명" }],
          },
        },
      }),
      ["instagram"]
    );
    expect(channels.instagram?.slides).toHaveLength(1);
    expect(warnings.join(" ")).toMatch(/3장 미만/);
  });

  it("clamps slide description and reddit title", () => {
    const { channels } = parseAdaptOutput(
      JSON.stringify({
        channels: {
          instagram: {
            caption: "캡션",
            slides: [
              {
                title: "제목",
                description: "가".repeat(
                  CHANNEL_LIMITS.instagram.slideDescription + 50
                ),
              },
            ],
          },
          reddit: { title: "제".repeat(400), content: "본문" },
        },
      }),
      ["instagram", "reddit"]
    );

    expect(channels.instagram?.slides[0].description).toHaveLength(
      CHANNEL_LIMITS.instagram.slideDescription
    );
    expect(channels.reddit?.title).toHaveLength(CHANNEL_LIMITS.reddit.title);
  });

  it("skips missing channels with a warning", () => {
    const { channels, warnings } = parseAdaptOutput(
      JSON.stringify({ channels: { linkedin: { content: "본문" } } }),
      ["linkedin", "threads"]
    );
    expect(channels.threads).toBeUndefined();
    expect(warnings.join(" ")).toMatch(/threads/);
  });

  it("throws when no channel is usable", () => {
    expect(() =>
      parseAdaptOutput(JSON.stringify({ channels: { linkedin: {} } }), [
        "linkedin",
      ])
    ).toThrow(AiParseError);
  });
});

describe("adaptContent", () => {
  it("throws AiNotConfiguredError without keys", async () => {
    await expect(adaptContent(request, { env: {} })).rejects.toBeInstanceOf(
      AiNotConfiguredError
    );
  });

  it("calls the Anthropic messages API and parses the JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      anthropicResponse({
        channels: {
          linkedin: { content: "링크드인 본문" },
          peerlist: { content: "피어리스트 초안" },
        },
      })
    );

    const result = await adaptContent(request, {
      env: { ANTHROPIC_API_KEY: "sk-ant-test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.provider).toBe("anthropic");
    expect(result.channels.linkedin?.content).toBe("링크드인 본문");
    expect(result.channels.peerlist?.content).toBe("피어리스트 초안");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("claude-sonnet-4-5");
    expect(body.max_tokens).toBeGreaterThan(1000);
    expect(body.system).toMatch(/single JSON object/);
    expect(body.messages[0].content).toContain(request.sourceText);
  });

  it("uses OpenAI chat completions when only that key exists", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        choices: [
          { message: { content: '{"linkedin":{"content":"오픈AI 본문"}}' } },
        ],
      })
    );

    const result = await adaptContent(request, {
      env: { OPENAI_API_KEY: "sk-openai-test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.provider).toBe("openai");
    expect(result.channels.linkedin?.content).toBe("오픈AI 본문");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-openai-test");

    const body = JSON.parse(String(init.body));
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual([
      "system",
      "user",
    ]);
  });

  it("calls the Gemini generateContent API and parses the JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                { text: "생각 과정", thought: true },
                {
                  text: JSON.stringify({
                    channels: {
                      linkedin: { content: "제미나이 본문" },
                      peerlist: { content: "피어리스트 초안" },
                    },
                  }),
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      })
    );

    const result = await adaptContent(request, {
      env: { GEMINI_API_KEY: "g-test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("gemini-3.8-flash");
    expect(result.channels.linkedin?.content).toBe("제미나이 본문");
    expect(result.channels.peerlist?.content).toBe("피어리스트 초안");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
    );
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("g-test");
    expect(headers.authorization).toBeUndefined();

    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction.parts[0].text).toMatch(/single JSON object/);
    expect(body.contents).toEqual([
      {
        role: "user",
        parts: [{ text: expect.stringContaining(request.sourceText) }],
      },
    ]);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThan(8192);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    // Gemini 3.6 이상은 temperature를 무시하므로 보내지 않는다.
    expect(body.generationConfig.temperature).toBeUndefined();
  });

  it("omits thinkingConfig for models that do not take it", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        candidates: [
          { content: { parts: [{ text: '{"linkedin":{"content":"본문"}}' }] } },
        ],
      })
    );

    await adaptContent(request, {
      env: { GEMINI_API_KEY: "g", GEMINI_MODEL: "gemini-2.5-flash" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toContain("/models/gemini-2.5-flash:generateContent");
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it("surfaces a Gemini block reason", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ promptFeedback: { blockReason: "SAFETY" }, candidates: [] })
    );

    await expect(
      adaptContent(request, {
        env: { GEMINI_API_KEY: "g" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toThrow(/SAFETY/);
  });

  it("maps Gemini quota errors to AiRequestError", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            code: 429,
            message: "Quota exceeded",
            status: "RESOURCE_EXHAUSTED",
          },
        },
        false,
        429
      )
    );

    await expect(
      adaptContent(request, {
        env: { GEMINI_API_KEY: "g" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({
      name: "AiRequestError",
      message: "Quota exceeded",
      status: 429,
    });
  });

  it("rejects a Gemini answer with no text parts", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        candidates: [{ content: { parts: [] }, finishReason: "MAX_TOKENS" }],
      })
    );

    await expect(
      adaptContent(request, {
        env: { GEMINI_API_KEY: "g" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toBeInstanceOf(AiParseError);
  });

  it("surfaces provider error messages", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { message: "invalid x-api-key" } }, false, 401)
    );

    await expect(
      adaptContent(request, {
        env: { ANTHROPIC_API_KEY: "bad" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({
      name: "AiRequestError",
      message: "invalid x-api-key",
      status: 401,
    });
  });

  it("maps a timeout to AiRequestError", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const fetchImpl = vi.fn(async () => {
      throw abort;
    });

    await expect(
      adaptContent(request, {
        env: { ANTHROPIC_API_KEY: "sk" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toBeInstanceOf(AiRequestError);
  });

  it("rejects an empty provider payload", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ content: [] }));

    await expect(
      adaptContent(request, {
        env: { ANTHROPIC_API_KEY: "sk" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toBeInstanceOf(AiParseError);
  });
});
