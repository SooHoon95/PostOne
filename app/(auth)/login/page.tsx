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
    });
    if (result.error) setError(result.error);
  }

  return (
    <div className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">로그인</h1>
      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full">로그인</Button>
      </form>
      <p className="text-sm text-slate-600">
        계정이 없으신가요? <Link href="/signup" className="underline">가입하기</Link>
      </p>
    </div>
  );
}
