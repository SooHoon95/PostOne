"use client";

import { signUp } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    const result = await signUp({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    });
    if (result.error) {
      setError(result.error);
    } else {
      setMessage("확인 이메일을 발송했습니다. 메일함을 확인해주세요.");
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
          <Label htmlFor="password">비밀번호 (8자 이상)</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-success">{message}</p>}
        <Button type="submit" className="w-full">가입</Button>
      </form>
      <p className="text-sm text-muted-foreground">
        이미 계정이 있으신가요? <Link href="/login" className="underline">로그인</Link>
      </p>
    </div>
  );
}
