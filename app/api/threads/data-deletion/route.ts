// Meta가 사용자 데이터 삭제 요청 시 호출하는 엔드포인트.
// Meta 정책: 응답 JSON에 url(상태 조회용)과 confirmation_code 포함.
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST() {
  const code = randomBytes(8).toString("hex");
  return NextResponse.json({
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/data-deletion-status?code=${code}`,
    confirmation_code: code,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
