import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron, runTokenRefreshCron } from "@/lib/scheduling/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 토큰 갱신 cron 엔드포인트.
 * 만료 24시간 이내 연결(LinkedIn·Threads·Instagram·Reddit)을 미리 갱신해
 * 예약 발행 시점의 토큰 만료 실패를 줄인다.
 * 인증: Authorization: Bearer <CRON_SECRET>
 */
async function handle(request: Request) {
  if (!(process.env.CRON_SECRET ?? "").trim()) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET이 설정되지 않았습니다." },
      { status: 503 }
    );
  }
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const summary = await runTokenRefreshCron({ supabase });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
