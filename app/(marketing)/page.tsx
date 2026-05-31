import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Send,
  Images,
  SplitSquareHorizontal,
  PenLine,
  MousePointerClick,
  Rocket,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChannelBadge, type Channel } from "@/components/channel-badge";
import { Reveal } from "@/components/marketing/reveal";
import { MultiChannelMockup } from "@/components/marketing/multi-channel-mockup";
import { BodyToCards } from "@/components/marketing/body-to-cards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "PostOne — 한 번 쓰고, 세 채널에 동시에",
  description:
    "본문 한 번이면 LinkedIn·Threads에 발행하고 인스타 캡션까지 채웁니다. 카드 내용만 입력하면 인스타 카드뉴스는 디자인까지 자동 완성. 퍼스널 브랜딩하는 직장인을 위한 멀티채널 퍼블리싱.",
};

const CHANNELS: { channel: Channel; label: string }[] = [
  { channel: "linkedin", label: "LinkedIn" },
  { channel: "threads", label: "Threads" },
  { channel: "instagram", label: "Instagram" },
];

const FEATURES = [
  {
    icon: Send,
    title: "채널마다 다시 안 써도 됩니다",
    description:
      "한 번 쓴 글이 LinkedIn·Threads·Instagram으로 한 번에 나갑니다. 복사·붙여넣기·재편집의 반복은 이제 끝.",
  },
  {
    icon: Images,
    title: "디자인 못 해도 카드뉴스가 나옵니다",
    description:
      "카드별 제목과 설명만 적으면 템플릿·배경을 입힌 인스타 캐러셀이 완성됩니다. 디자인 툴도, 손맛도 필요 없어요.",
  },
  {
    icon: SplitSquareHorizontal,
    title: "본문과 카드를 따로 다듬습니다",
    description:
      "텍스트 본문과 카드 슬라이드를 한 화면에서 분리해 손봅니다. 채널별 글자 수도 쓰는 동안 바로 확인하세요.",
  },
];

const STEPS = [
  {
    icon: PenLine,
    no: "1",
    title: "한 번 작성",
    description: "하고 싶은 이야기를 본문에 그냥 적습니다. 채널 신경 쓸 필요 없어요.",
  },
  {
    icon: MousePointerClick,
    no: "2",
    title: "채널 선택",
    description: "발행할 채널을 고르면 길이와 형식이 알아서 맞춰집니다.",
  },
  {
    icon: Rocket,
    no: "3",
    title: "동시 발행 + 카드 자동 생성",
    description: "버튼 하나로 세 채널에 발행, 인스타엔 카드뉴스까지 함께 올라갑니다.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* ============================= HERO ============================= */}
      <section className="relative overflow-hidden">
        {/* ambient brand wash */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[40rem] max-w-5xl rounded-full bg-brand/10 blur-3xl dark:bg-brand/15"
        />
        <div className="container grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-8 lg:py-28">
          {/* copy */}
          <Reveal className="flex flex-col items-start gap-6 text-left">
            <Badge variant="default" className="px-3 py-1 text-xs">
              <Sparkles className="size-3.5" aria-hidden="true" />
              곧 출시 · 베타 신청 받는 중
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              한 번 쓰고,
              <br />
              <span className="bg-gradient-to-r from-brand to-brand-accent bg-clip-text text-transparent">
                세 채널에 동시에.
              </span>
            </h1>
            <p className="max-w-xl text-balance text-lg leading-relaxed text-muted-foreground">
              본문 하나면 LinkedIn·Threads 발행과 인스타 캡션이 한 번에. 카드
              내용만 넣으면 인스타 카드뉴스는 디자인까지 자동 완성. 콘텐츠 만드는
              시간 대신, 콘텐츠에 집중하세요.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "lg" }), "group gap-2")}
              >
                무료로 시작
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                로그인
              </Link>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-1.5">
                {CHANNELS.map(({ channel }) => (
                  <ChannelBadge key={channel} channel={channel} size="md" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                세 채널을 한 자리에서
              </span>
            </div>
          </Reveal>

          {/* multi-channel publishing visual */}
          <Reveal delay={120} className="relative flex justify-center lg:justify-end">
            <MultiChannelMockup />
          </Reveal>
        </div>
      </section>

      {/* ===================== SUPPORTED CHANNELS BAND ===================== */}
      <section className="border-y bg-muted/40">
        <div className="container py-8">
          <Reveal className="flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-center sm:gap-8">
            <p className="text-sm font-medium text-muted-foreground">
              한 번 쓰면 세 채널에 동시 발행
            </p>
            <div className="flex items-center gap-5">
              {CHANNELS.map(({ channel, label }) => (
                <div key={channel} className="flex items-center gap-2">
                  <ChannelBadge channel={channel} size="lg" />
                  <span className="text-sm font-semibold text-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================= CORE FEATURES ========================= */}
      <section className="container py-20 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            왜 PostOne인가
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            발행은 빠르게, 시간은 글쓰기에
          </h2>
          <p className="mt-4 text-balance text-lg text-muted-foreground">
            기능을 자랑하기보다, 당신이 덜 일하게 만드는 데 집중했습니다.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }, i) => (
            <Reveal key={title} delay={i * 90}>
              <Card interactive className="group h-full">
                <CardHeader className="space-y-4">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription className="text-[15px] leading-relaxed">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* =========================== HOW IT WORKS =========================== */}
      <section className="border-t bg-muted/30">
        <div className="container py-20 sm:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">
              작동 방식
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              세 단계면 끝납니다
            </h2>
          </Reveal>

          <div className="relative mt-14 grid gap-8 md:grid-cols-3">
            {/* connecting line (md+) */}
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            />
            {STEPS.map(({ icon: Icon, no, title, description }, i) => (
              <Reveal
                key={no}
                delay={i * 120}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative z-10 mb-5 flex size-14 items-center justify-center rounded-full border-2 border-brand/30 bg-background text-brand shadow-sm">
                  <Icon className="size-6" aria-hidden="true" />
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
                    {no}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
                {i < STEPS.length - 1 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-6 size-5 rotate-90 text-brand/50 md:hidden"
                  />
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CARD-NEWS SPOTLIGHT ===================== */}
      <section className="container py-20 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="channel-instagram" className="px-3 py-1">
            <Sparkles className="size-3.5" aria-hidden="true" />
            PostOne만의 차별점
          </Badge>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            카드 내용만 넣으면, 카드뉴스가 완성됩니다
          </h2>
          <p className="mt-4 text-balance text-lg text-muted-foreground">
            카드별 제목과 설명만 입력하면 표지부터 마무리까지 템플릿·배경을 입혀
            인스타 캐러셀로 만들어 둡니다. 디자인은 PostOne 몫이에요.
          </p>
        </Reveal>

        <Reveal delay={120} className="mx-auto mt-14 max-w-5xl">
          <div className="rounded-2xl border bg-card/60 p-6 shadow-sm sm:p-10">
            <BodyToCards />
          </div>
        </Reveal>
      </section>

      {/* ===================== PRICING / FREE ACCENT ===================== */}
      <section id="pricing" className="scroll-mt-16 border-t bg-muted/30">
        <div className="container py-20 sm:py-24">
          <Reveal className="mx-auto max-w-xl text-center">
            <Badge variant="success" className="px-3 py-1">
              <Sparkles className="size-3.5" aria-hidden="true" />
              지금은 무료
            </Badge>
            <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              부담 없이 먼저 써보세요
            </h2>
            <p className="mt-4 text-balance text-lg text-muted-foreground">
              베타 기간 동안 모든 기능을 무료로 열어두었습니다. 카드 없이 바로
              시작하고, 마음에 들면 계속 쓰면 됩니다.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "lg" }), "group gap-2")}
              >
                무료로 시작
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/signup"
                className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
              >
                베타 신청하기
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================== FINAL CTA ========================== */}
      <section className="container py-20 sm:py-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-accent px-6 py-16 text-center shadow-lg sm:px-12 sm:py-20">
            {/* subtle light streaks (white overlays, no extra color tokens) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,rgba(255,255,255,0.25),transparent_50%)]"
            />
            <div className="relative">
              <h2 className="text-balance text-3xl font-extrabold tracking-tight text-brand-foreground sm:text-4xl lg:text-5xl">
                글 쓰는 시간만 남기세요
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-brand-foreground/85">
                발행도, 카드뉴스도 PostOne이 합니다. 오늘 쓴 글로 세 채널을
                채워보세요.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/signup"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "group gap-2 bg-background text-foreground shadow-sm hover:bg-background/90"
                  )}
                >
                  무료로 시작
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
