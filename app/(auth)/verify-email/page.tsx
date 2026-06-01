import Link from "next/link";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth/get-user";
import { ResendConfirmation } from "@/components/resend-confirmation";

export const metadata: Metadata = {
  title: "이메일 인증",
  description: "가입을 완료하려면 이메일 인증이 필요합니다.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const queryEmail = searchParams?.email?.trim();
  let email = queryEmail ?? "";
  if (!email) {
    // 미인증 세션 가드로 들어온 경우엔 현재 사용자 이메일을 사용
    const user = await getUser();
    email = user?.email ?? "";
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
        <h1 className="text-lg font-semibold text-foreground">이메일 인증 필요</h1>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          {email ? (
            <>
              <span className="font-medium text-foreground">{email}</span> 주소로{" "}
            </>
          ) : (
            "가입하신 이메일 주소로 "
          )}
          인증 링크를 보냈습니다. 메일함(스팸함 포함)에서 링크를 눌러 인증을
          완료해주세요.
        </p>
        <p>인증을 완료해야 로그인할 수 있습니다.</p>
      </div>

      <ResendConfirmation email={email} />

      <p className="text-sm text-muted-foreground">
        <Link href="/login" className="underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </div>
  );
}
