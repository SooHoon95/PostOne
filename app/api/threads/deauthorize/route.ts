// Meta가 사용자가 앱을 제거했을 때 호출하는 웹훅 엔드포인트.
// MVP 단계에서는 200 OK만 반환 (실제 정리는 별도 cron 또는 사용자가 수동 처리).
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Meta가 GET으로 확인 요청을 보낼 수도 있음
  return NextResponse.json({ ok: true });
}
