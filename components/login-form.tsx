"use client";

import { signIn } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

// /auth/callback 에서 넘어오는 인증 오류 코드 → 사용자 메시지
const CALLBACK_ERRORS: Record<string, string> = {
  link_expired: "인증 링크가 만료되었습니다. 인증 메일을 다시 받아주세요.",
  verify_failed: "이메일 인증에 실패했습니다. 다시 시도해주세요.",
  invalid_link: "잘못된 인증 링크입니다.",
};

export function LoginForm({ errorParam }: { errorParam?: string }) {
  const [error, setError] = useState<string | null>(
    errorParam ? CALLBACK_ERRORS[errorParam] ?? null : null
  );
  const [needsVerifyEmail, setNeedsVerifyEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setNeedsVerifyEmail(null);
    setSubmitting(true);
    const email = (formData.get("email") as string).trim();
    const result = await signIn({
      email,
      password: formData.get("password") as string,
      remember: formData.get("remember") === "on",
    });
    // 성공 시 signIn 내부에서 redirect → 아래 코드는 실패 시에만 실행
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      if (result.code === "email_not_confirmed") setNeedsVerifyEmail(email);
    }
  }

  return (
    <div className="space-y-6 rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-1.5 text-center">
        <Link
          href="/"
          className="inline-block text-2xl font-bold tracking-tight"
        >
          Post<span className="text-primary">One</span>
        </Link>
        <p className="text-sm text-muted-foreground">
          한 번 작성해 모든 채널에 발행하세요.
        </p>
      </div>
      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="remember"
            name="remember"
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
            로그인 상태 유지
          </Label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {needsVerifyEmail && (
          <Link
            href={`/verify-email?email=${encodeURIComponent(needsVerifyEmail)}`}
            className="block text-sm text-primary underline"
          >
            인증 메일 다시 받기
          </Link>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "로그인 중..." : "로그인"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        계정이 없으신가요? <Link href="/signup" className="underline">가입하기</Link>
      </p>
    </div>
  );
}
