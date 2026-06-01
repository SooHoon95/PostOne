// Meta가 사용자가 앱을 제거(권한 해제)했을 때 호출하는 웹훅 엔드포인트.
// MVP 단계에서는 200 OK만 반환한다. (실제 토큰/연동 정리는 향후 signed_request
// 서명 검증 후 service-role로 삭제하도록 하드닝 예정 — App Review 사전요건으로 우선
// 엔드포인트만 제공.)
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Meta가 GET으로 확인 요청을 보낼 수도 있음
  return NextResponse.json({ ok: true });
}
