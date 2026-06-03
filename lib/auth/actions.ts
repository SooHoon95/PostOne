"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REMEMBER_COOKIE, REMEMBER_MAX_AGE } from "@/lib/supabase/cookie-options";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Credentials = { email: string; password: string };
type ActionResult = { error?: string; code?: string };
type SignUpResult = { error?: string; ok?: boolean };

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function signUp({ email, password }: Credentials): Promise<SignUpResult> {
  if (!EMAIL_RE.test(email)) return { error: "이메일 형식이 올바르지 않습니다." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  // Supabase "Confirm email"이 켜져 있으면 여기서 세션은 발급되지 않고 확인 메일만
  // 발송된다. 이미 가입된 이메일이어도 Supabase가 동일한 성공 응답을 주므로(계정
  // 열거 방지) 항상 같은 "메일 확인" 흐름으로 응답한다.
  return { ok: true };
}

export async function resendConfirmation({
  email,
}: {
  email: string;
}): Promise<ActionResult> {
  if (!EMAIL_RE.test(email)) return { error: "이메일 형식이 올바르지 않습니다." };

  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${appUrl()}/auth/callback` },
  });
  if (error) return { error: error.message };
  return {};
}

// 메일로 받은 숫자 인증 코드(OTP)로 가입 확인. 성공 시 세션이 발급되고 대시보드로
// 이동한다. (Supabase 이메일 템플릿이 {{ .Token }}을 보내도록 설정되어 있어야 함)
export async function verifyEmailOtp({
  email,
  token,
}: {
  email: string;
  token: string;
}): Promise<ActionResult> {
  if (!EMAIL_RE.test(email)) return { error: "이메일 형식이 올바르지 않습니다." };
  const code = token.trim();
  if (!/^\d{4,10}$/.test(code)) {
    return { error: "인증 코드를 정확히 입력해주세요." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) {
    return { error: "코드가 올바르지 않거나 만료되었습니다. 다시 시도해주세요." };
  }
  // 가입 인증 직후엔 환영 페이지로 → "시작하기"에서 대시보드 진입
  redirect("/welcome");
}

export async function signIn({
  email,
  password,
  remember = false,
}: Credentials & { remember?: boolean }): Promise<ActionResult> {
  const cookieStore = cookies();
  // signInWithPassword가 auth 쿠키를 쓰기 전에 정책 플래그를 먼저 심는다.
  cookieStore.set(REMEMBER_COOKIE, remember ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_MAX_AGE } : {}),
  });

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // 인증 실패 시 플래그를 남기면 다음 요청에서 기존 세션 만료가 연장될 수 있다.
    cookieStore.delete(REMEMBER_COOKIE);

    const msg = (error.message ?? "").toLowerCase();
    const code = (error as { code?: string }).code;
    if (code === "email_not_confirmed" || msg.includes("not confirmed")) {
      return {
        error: "이메일 인증이 필요합니다. 메일함에서 인증 링크를 확인해주세요.",
        code: "email_not_confirmed",
      };
    }
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createClient();
  cookies().delete(REMEMBER_COOKIE);
  await supabase.auth.signOut();
  redirect("/login");
}
