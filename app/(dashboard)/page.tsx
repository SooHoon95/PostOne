import { requireUser } from "@/lib/auth/get-user";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Plug, PenLine, ArrowRight } from "lucide-react";

const steps = [
  {
    href: "/settings/connections",
    step: 1,
    icon: Plug,
    title: "채널 연동",
    description: "LinkedIn · Threads · Instagram 계정을 연결하세요.",
  },
  {
    href: "/compose",
    step: 2,
    icon: PenLine,
    title: "글쓰기",
    description: "한 번 작성해 여러 채널에 동시에 발행하세요.",
  },
];

export default async function DashboardHome() {
  const user = await requireUser();
  return (
    <div className="space-y-8">
      <PageHeader
        title="안녕하세요"
        description={user.email ?? undefined}
      />

      <section className="space-y-4">
        <h2 className="text-base font-medium text-foreground">시작하기</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {steps.map(({ href, step, icon: Icon, title, description }) => (
            <Link key={href} href={href} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <Card interactive className="flex h-full items-start gap-4 p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      STEP {step}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 translate-x-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
