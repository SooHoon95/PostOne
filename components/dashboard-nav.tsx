import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function DashboardNav({ email }: { email: string }) {
  return (
    <nav className="flex items-center justify-between border-b bg-card px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Post<span className="text-primary">One</span>
        </Link>
        <Link href="/compose" className="text-sm text-muted-foreground hover:text-foreground">글쓰기</Link>
        <Link href="/history" className="text-sm text-muted-foreground hover:text-foreground">발행 이력</Link>
        <Link href="/settings/connections" className="text-sm text-muted-foreground hover:text-foreground">채널 연동</Link>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
        <ThemeToggle />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">로그아웃</Button>
        </form>
      </div>
    </nav>
  );
}
