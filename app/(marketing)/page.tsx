import Link from "next/link";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ChannelBadge } from "@/components/channel-badge";
import { cn } from "@/lib/utils";
import { Send, Images, SplitSquareHorizontal } from "lucide-react";

export const metadata: Metadata = {
  title: "PostOne — 한 번 쓰고, 모든 채널에",
  description:
    "LinkedIn · Threads · Instagram에 한 번에 발행하는 멀티채널 퍼블리싱 도구. 인스타 카드뉴스 자동 생성까지.",
};

const features = [
  {
    icon: Send,
    title: "멀티채널 동시 발행",
    description:
      "한 번 작성한 글을 LinkedIn·Threads·Instagram에 동시에 올립니다. 채널마다 다시 붙여넣을 필요가 없습니다.",
  },
  {
    icon: Images,
    title: "인스타 카드뉴스 자동 생성",
    description:
      "긴 본문을 인스타그램 카드 이미지로 자동 분할·렌더링합니다. 디자인 도구 없이 캐러셀이 완성됩니다.",
  },
  {
    icon: SplitSquareHorizontal,
    title: "본문·카드 분리 에디터",
    description:
      "텍스트 본문과 카드 슬라이드를 한 화면에서 따로 다듬습니다. 채널별 길이 제한도 실시간으로 확인하세요.",
  },
];

export default function LandingPage() {
  return (
    <div className="container">
      <section className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
        <div className="flex items-center gap-2">
          <ChannelBadge channel="linkedin" />
          <ChannelBadge channel="threads" />
          <ChannelBadge channel="instagram" />
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          한 번 쓰고, 모든 채널에
        </h1>
        <p className="text-balance max-w-2xl text-lg text-muted-foreground">
          LinkedIn · Threads · Instagram에 동시 발행하고, 긴 글은 인스타 카드뉴스로
          자동 생성합니다. 글 하나로 모든 채널을 챙기세요.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
            무료로 시작
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            로그인
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-24 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="h-full">
            <CardHeader className="space-y-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
