import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function DashboardNav({ email }: { email: string }) {
  return (
    <nav className="flex items-center justify-between border-b bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-semibold">OnePost</Link>
        <Link href="/compose" className="text-sm text-slate-700 hover:text-slate-900">글쓰기</Link>
        <Link href="/history" className="text-sm text-slate-700 hover:text-slate-900">발행 이력</Link>
        <Link href="/settings/connections" className="text-sm text-slate-700 hover:text-slate-900">채널 연동</Link>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">{email}</span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">로그아웃</Button>
        </form>
      </div>
    </nav>
  );
}
