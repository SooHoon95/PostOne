import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Post<span className="text-primary">One</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              무료로 시작
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-3 py-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} PostOne</p>
          <nav className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              개인정보처리방침
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              이용약관
            </Link>
            <Link href="/login" className="hover:text-foreground">
              로그인
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
