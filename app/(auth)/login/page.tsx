"use client";

import { signIn } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const result = await signIn({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      remember: formData.get("remember") === "on",
    });
    if (result.error) setError(result.error);
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
        <Button type="submit" className="w-full">로그인</Button>
      </form>
      <p className="text-sm text-muted-foreground">
        계정이 없으신가요? <Link href="/signup" className="underline">가입하기</Link>
      </p>
    </div>
  );
}
