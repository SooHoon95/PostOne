import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type OtpType = "signup" | "email" | "recovery" | "email_change" | "invite";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const authError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  // open redirect 방지: 같은 출처의 상대 경로만 허용한다.
  const rawNext = url.searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const toLogin = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

  // Supabase가 만료/오류를 쿼리로 돌려준 경우 (예: 만료된 인증 링크)
  if (authError) return toLogin("link_expired");

  const supabase = createClient();

  // PKCE 흐름 (기본): 이메일 링크 → Supabase verify → ?code=... 로 콜백
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return toLogin("verify_failed");
    return NextResponse.redirect(new URL(next, request.url));
  }

  // token_hash 흐름 (이메일 템플릿이 {{ .TokenHash }}를 쓰는 경우)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as OtpType,
      token_hash: tokenHash,
    });
    if (error) return toLogin("verify_failed");
    return NextResponse.redirect(new URL(next, request.url));
  }

  return toLogin("invalid_link");
}
