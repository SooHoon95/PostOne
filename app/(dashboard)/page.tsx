import { requireUser } from "@/lib/auth/get-user";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export default async function DashboardHome() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">안녕하세요, {user.email}</h1>
      <Card className="p-6">
        <h2 className="text-lg font-semibold">시작하기</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-foreground">
          <li>
            <Link href="/settings/connections" className="underline">
              채널 연동
            </Link>{" "}
            — LinkedIn 연결
          </li>
          <li>
            <Link href="/compose" className="underline">
              글쓰기
            </Link>{" "}
            — 첫 글 발행
          </li>
        </ol>
      </Card>
    </div>
  );
}
