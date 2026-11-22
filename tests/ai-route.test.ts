/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getUserMock = vi.fn();

vi.mock("@/lib/auth/get-user", () => ({
  getUser: getUserMock,
}));

const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
] as const;

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  getUserMock.mockReset();
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/ai/adapt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  sourceText: "뮤터 앱을 출시했다.",
  channels: ["linkedin", "peerlist"],
  language: "ko",
};

async function callRoute(body: unknown) {
  const { POST } = await import("@/app/api/ai/adapt/route");
  const res = await POST(makeRequest(body) as unknown as Request);
  return { status: res.status, body: await res.json() };
}

describe("POST /api/ai/adapt", () => {
  it("returns 401 without a session", async () => {
    getUserMock.mockResolvedValue(null);
    const { status, body } = await callRoute(validBody);
    expect(status).toBe(401);
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("returns 403 for an unverified email", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", email_confirmed_at: null });
    const { status, body } = await callRoute(validBody);
    expect(status).toBe(403);
    expect(body.error).toBe("EMAIL_NOT_VERIFIED");
  });

  it("returns 400 for a non-JSON body", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", email_confirmed_at: "t" });
    const { status, body } = await callRoute("not json");
    expect(status).toBe(400);
    expect(body.error).toBe("INVALID_JSON");
  });

  it("returns 400 for invalid input", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", email_confirmed_at: "t" });
    const missingText = await callRoute({ channels: ["linkedin"] });
    expect(missingText.status).toBe(400);
    expect(missingText.body.field).toBe("sourceText");

    const badChannel = await callRoute({
      ...validBody,
      channels: ["linkedin", "myspace"],
    });
    expect(badChannel.status).toBe(400);
    expect(badChannel.body.message).toMatch(/myspace/);

    const badLanguage = await callRoute({ ...validBody, language: "fr" });
    expect(badLanguage.status).toBe(400);
    expect(badLanguage.body.field).toBe("language");
  });

  it("returns 503 with a helpful message when no AI key is configured", async () => {
    getUserMock.mockResolvedValue({ id: "user-1", email_confirmed_at: "t" });
    const { status, body } = await callRoute(validBody);
    expect(status).toBe(503);
    expect(body.error).toBe("AI_NOT_CONFIGURED");
    expect(body.message).toMatch(/ANTHROPIC_API_KEY/);
    expect(body.message).toMatch(/OPENAI_API_KEY/);
  });

  it("returns the adapted channels when the provider answers", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    getUserMock.mockResolvedValue({ id: "user-1", email_confirmed_at: "t" });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              channels: {
                linkedin: { content: "링크드인 본문" },
                peerlist: { content: "피어리스트 초안" },
              },
            }),
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { status, body } = await callRoute(validBody);
    expect(status).toBe(200);
    expect(body.provider).toBe("anthropic");
    expect(body.channels.linkedin.content).toBe("링크드인 본문");
    expect(body.channels.peerlist.content).toBe("피어리스트 초안");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when the provider fails", async () => {
    process.env.OPENAI_API_KEY = "sk-openai-test";
    getUserMock.mockResolvedValue({ id: "user-1", email_confirmed_at: "t" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "rate limited" } }),
      }))
    );

    const { status, body } = await callRoute(validBody);
    expect(status).toBe(502);
    expect(body.error).toBe("AI_REQUEST_FAILED");
    expect(body.message).toMatch(/rate limited/);
  });
});
