import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron, runPublishCron } from "@/lib/scheduling/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 예약 발행 cron 엔드포인트.
 * Supabase pg_cron(1분) 또는 Vercel Cron 이 호출한다.
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
    // 한 번에 5건 — 카드 렌더·업로드가 섮인 인스타 발행까지 60초(maxDuration) 안에 끝내기 위함.
    // 남은 due 건은 다음 1분 주기에 이어진다.
    const summary = await runPublishCron({ supabase, limit: 5 });
    if (summary.published > 0) revalidatePath("/history");
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
