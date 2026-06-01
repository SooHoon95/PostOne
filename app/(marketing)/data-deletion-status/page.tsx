import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "데이터 삭제 상태",
  description: "데이터 삭제 요청 처리 상태 확인.",
};

// Meta 데이터 삭제 콜백이 반환하는 url(/data-deletion-status?code=...)의 도착지.
// 사용자/Meta가 확인 코드로 삭제 요청 접수 여부를 확인하는 정적 상태 페이지.
export default function DataDeletionStatusPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams?.code?.trim();

  return (
    <div className="container max-w-2xl py-16">
      <div className="space-y-4 rounded-lg border bg-card p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          데이터 삭제 요청 접수
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          데이터 삭제 요청이 정상적으로 접수되었습니다. PostOne은 보관 중인 해당
          계정의 연동 데이터(액세스 토큰, 채널 연동 정보 등)를 파기합니다. 이미 각
          플랫폼에 발행된 게시물은 해당 플랫폼에서 직접 삭제해야 합니다.
        </p>
        {code ? (
          <p className="text-sm text-muted-foreground">
            확인 코드:{" "}
            <span className="rounded bg-muted px-2 py-1 font-mono text-foreground">
              {code}
            </span>
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          문의: [문의 이메일]
        </p>
      </div>
    </div>
  );
}
