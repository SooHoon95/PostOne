import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import {
  adaptContent,
  AiNotConfiguredError,
  AiParseError,
  AiRequestError,
  isAiConfigured,
} from "@/lib/ai/adapt";
import { parseAdaptRequest } from "@/lib/ai/types";

// AI 호출은 스트리밍 없이 한 번에 기다린다 — Vercel 함수 최대 60초.
export const runtime = "nodejs";
export const maxDuration = 60;

const NOT_CONFIGURED_MESSAGE =
  "AI 기능이 아직 설정되지 않았습니다. 서버에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY를 등록해주세요.";

/**
 * POST /api/ai/adapt
 * body: { sourceText, channels[], subreddit?, language? }
 * 인증된 사용자만 호출할 수 있고, 프로바이더 키가 없으면 503으로 안내한다.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "EMAIL_NOT_VERIFIED", message: "이메일 인증이 필요합니다." },
      { status: 403 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "요청 본문이 JSON이 아닙니다." },
      { status: 400 }
    );
  }

  const parsed = parseAdaptRequest(payload);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: parsed.error, field: parsed.field },
      { status: 400 }
    );
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI_NOT_CONFIGURED", message: NOT_CONFIGURED_MESSAGE },
      { status: 503 }
    );
  }

  try {
    const result = await adaptContent(parsed.value);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI_NOT_CONFIGURED", message: NOT_CONFIGURED_MESSAGE },
        { status: 503 }
      );
    }
    if (e instanceof AiParseError) {
      return NextResponse.json(
        {
          error: "AI_BAD_RESPONSE",
          message: "AI 응답을 해석하지 못했습니다. 다시 시도해주세요.",
        },
        { status: 502 }
      );
    }
    if (e instanceof AiRequestError) {
      return NextResponse.json(
        { error: "AI_REQUEST_FAILED", message: e.message },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "AI_UNKNOWN", message: "AI 변환에 실패했습니다." },
      { status: 500 }
    );
  }
}
