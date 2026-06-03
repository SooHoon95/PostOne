import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/get-user";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "가입 완료",
  description: "PostOne 가입을 환영합니다.",
};

export default async function WelcomePage() {
  // 인증 완료(세션 보유) 사용자만 — 미로그인/미인증은 requireUser가 처리.
  const user = await requireUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-accent text-brand-foreground shadow-lg">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            가입을 환영합니다
          </h1>
          <p className="text-balance text-muted-foreground">
            이메일 인증이 완료됐어요. 이제 한 번 작성해 링크드인·스레드·인스타그램에
            동시 발행할 수 있습니다.
          </p>
          {user.email ? (
            <p className="text-sm text-muted-foreground">{user.email}</p>
          ) : null}
        </div>

        <Link
          href="/dashboard"
          className={cn(buttonVariants({ size: "lg" }), "group w-full gap-2")}
        >
          시작하기
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </main>
  );
}
