import * as React from "react";
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
  Check,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChannelBadge, type Channel } from "@/components/channel-badge";
import { Reveal } from "@/components/marketing/reveal";
import { SlideIn } from "@/components/marketing/slide-in";
import { CardNewsMockup } from "@/components/marketing/card-news-mockup";
import { BodyToCards } from "@/components/marketing/body-to-cards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "PostOne — 한 번 작성, 세 채널 동시 발행 (클래식)",
  description:
    "본문 한 번이면 LinkedIn·Threads·Instagram 동시 발행, 인스타 카드뉴스 자동 생성. 퍼스널 브랜딩 직장인을 위한 멀티채널 퍼블리싱.",
};

const CHANNELS: { channel: Channel; label: string }[] = [
  { channel: "linkedin", label: "LinkedIn" },
  { channel: "threads", label: "Threads" },
  { channel: "instagram", label: "Instagram" },
];

/* 기능 — 큰 좌우 교차 블록. 각 행이 풀폭 2단(텍스트 ↔ 비주얼).
   비주얼은 행마다 다른 데모를 배치해 중복을 피한다. */
type FeatureRow = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  /** 비주얼 칸 렌더러 — 행마다 다른 데모. */
  visual: "deck" | "bodyToCards" | "channels";
};

const FEATURE_ROWS: FeatureRow[] = [
  {
    icon: Send,
    eyebrow: "동시 발행",
    title: "채널별 재작성 불필요",
    description:
      "한 번 쓴 글의 LinkedIn·Threads·Instagram 동시 송출. 복사·붙여넣기·재편집 반복의 종료.",
    points: ["세 채널 한 번에 송출", "채널별 길이 자동 정렬", "발행 시점 일괄 관리"],
    visual: "channels",
  },
  {
    icon: Images,
    eyebrow: "카드뉴스 자동화",
    title: "디자인 없이 카드뉴스 완성",
    description:
      "긴 본문의 인스타 카드 슬라이드 자동 분할. 디자인 툴 없는 캐러셀 한 세트 완성.",
    points: ["표지부터 마무리까지 자동 구성", "문단 단위 슬라이드 분할", "브랜드 톤 일관 적용"],
    visual: "deck",
  },
  {
    icon: SplitSquareHorizontal,
    eyebrow: "분리 편집",
    title: "본문과 카드 분리 편집",
    description:
      "텍스트 본문과 카드 슬라이드의 한 화면 분리 편집. 채널별 글자 수 실시간 확인.",
    points: ["본문·카드 동시 편집", "채널별 글자 수 실시간 표시", "퇴고 즉시 카드 반영"],
    visual: "bodyToCards",
  },
];

const STEPS = [
  {
    icon: PenLine,
    no: "01",
    title: "한 번 작성",
    description: "하고 싶은 이야기의 본문 입력. 채널 고려 불필요.",
  },
  {
    icon: MousePointerClick,
    no: "02",
    title: "채널 선택",
    description: "발행 채널 선택만으로 길이·형식 자동 정렬.",
  },
  {
    icon: Rocket,
    no: "03",
    title: "동시 발행 + 카드 자동 생성",
    description: "버튼 하나로 세 채널 발행, 인스타 카드뉴스 동시 업로드.",
  },
];

/** 기능 행의 비주얼 칸 — 행마다 다른 데모를 크게 렌더. */
function FeatureVisual({ kind }: { kind: FeatureRow["visual"] }) {
  if (kind === "deck") {
    return (
      <div className="relative flex justify-center py-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-brand/10 blur-3xl dark:bg-brand/15"
        />
        <CardNewsMockup className="max-w-[18rem]" />
      </div>
    );
  }

  if (kind === "bodyToCards") {
    return (
      <div className="rounded-3xl border bg-card/60 p-5 shadow-sm sm:p-7">
        <BodyToCards />
      </div>
    );
  }

  // channels — 동시 발행 데모(채널별 미니 카드)
  return (
    <div className="rounded-3xl border bg-card/60 p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="grid size-6 place-items-center rounded-md bg-brand/10 text-brand">
          <Send className="size-3.5" aria-hidden="true" />
        </span>
        한 번의 발행, 세 갈래 송출
      </div>
      <div className="space-y-3">
        {[
          { channel: "linkedin" as Channel, label: "LinkedIn", note: "롱폼 본문 그대로" },
          { channel: "threads" as Channel, label: "Threads", note: "짧은 호흡으로 자동 분할" },
          { channel: "instagram" as Channel, label: "Instagram", note: "카드뉴스 캐러셀 첨부" },
        ].map(({ channel, label, note }) => (
          <div
            key={channel}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3"
          >
            <ChannelBadge channel={channel} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="truncate text-xs text-muted-foreground">{note}</p>
            </div>
            <span className="ml-auto grid size-6 shrink-0 place-items-center rounded-full bg-success/12 text-success">
              <Check className="size-3.5" aria-hidden="true" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClassicLandingPage() {
  return (
    <>
      {/* ============== HERO — CENTERED, FULL-WIDTH STACK ============== */}
      {/* A는 좌우분할. B는 중앙 정렬 풀폭 스택으로 인상을 정반대로 둔다. */}
      <section className="relative overflow-hidden border-b">
        {/* 중앙으로 모이는 ambient wash */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-32 -z-10 mx-auto h-[34rem] max-w-3xl rounded-full bg-brand/10 blur-3xl dark:bg-brand/15"
        />
        {/* 미세 그리드 텍스처 (토큰 기반) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-30 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
        />

        <div className="container flex flex-col items-center gap-8 py-20 text-center sm:py-24 lg:py-28">
          <Reveal className="flex flex-col items-center gap-6">
            <Badge variant="default" className="px-3 py-1 text-xs">
              <Sparkles className="size-3.5" aria-hidden="true" />
              곧 출시 · 베타 신청 접수 중
            </Badge>
            <h1 className="max-w-4xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              한 번 작성,{" "}
              <span className="bg-gradient-to-r from-brand to-brand-accent bg-clip-text text-transparent">
                세 채널 동시 발행.
              </span>
            </h1>
            <p className="max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
              본문 하나의 LinkedIn·Threads·Instagram 동시 발행. 긴 글의 인스타
              카드뉴스 자동 변환까지. 콘텐츠 제작 시간 대신 콘텐츠 그 자체에 집중.
            </p>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
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

            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                {CHANNELS.map(({ channel }) => (
                  <ChannelBadge key={channel} channel={channel} size="md" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">세 채널 한 자리</span>
            </div>
          </Reveal>

          {/* 히어로 비주얼 — 카피 아래 중앙에 크게 (좌우분할 아님) */}
          <Reveal delay={140} className="relative mt-4 w-full">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-10 -z-10 mx-auto h-72 max-w-2xl rounded-full bg-brand-accent/10 blur-3xl"
            />
            <CardNewsMockup className="max-w-md sm:max-w-lg" />
          </Reveal>
        </div>
      </section>

      {/* =============== SUPPORTED CHANNELS BAND =============== */}
      <section className="border-b bg-muted/40">
        <div className="container py-8">
          <Reveal className="flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-center sm:gap-8">
            <p className="text-sm font-medium text-muted-foreground">
              한 번 작성, 세 채널 동시 발행
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

      {/* ========= CORE FEATURES — BIG ALTERNATING ROWS ========= */}
      {/* A는 작은 3카드 그리드. B는 풀폭 2단 좌우 교차 블록. */}
      <section className="border-b">
        <div className="container py-20 sm:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">
              왜 PostOne인가
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              빠른 발행, 글쓰기에 집중된 시간
            </h2>
            <p className="mt-4 text-balance text-lg text-muted-foreground">
              기능 과시 대신 당신의 노동 절감에 집중된 설계.
            </p>
          </Reveal>

          <div className="mt-16 flex flex-col gap-20 sm:gap-28">
            {FEATURE_ROWS.map(
              ({ icon: Icon, eyebrow, title, description, points, visual }, i) => {
                const textFirst = i % 2 === 0; // 1행 텍스트좌 → 2행 비주얼좌 → 3행 텍스트좌
                return (
                  <div
                    key={title}
                    className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
                  >
                    {/* TEXT */}
                    <SlideIn
                      from={textFirst ? "left" : "right"}
                      className={cn(
                        "flex flex-col items-start gap-5",
                        textFirst ? "lg:order-1" : "lg:order-2"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
                          <Icon className="size-6" aria-hidden="true" />
                        </span>
                        <span className="text-sm font-semibold uppercase tracking-wide text-brand">
                          {eyebrow}
                        </span>
                      </div>
                      <h3 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        {title}
                      </h3>
                      <p className="max-w-lg text-balance text-lg leading-relaxed text-muted-foreground">
                        {description}
                      </p>
                      <ul className="flex flex-col gap-2.5 pt-1">
                        {points.map((point) => (
                          <li
                            key={point}
                            className="flex items-center gap-2.5 text-[15px] font-medium text-foreground"
                          >
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/12 text-brand">
                              <Check className="size-3.5" aria-hidden="true" />
                            </span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </SlideIn>

                    {/* VISUAL */}
                    <SlideIn
                      from={textFirst ? "right" : "left"}
                      delay={120}
                      className={cn(textFirst ? "lg:order-2" : "lg:order-1")}
                    >
                      <FeatureVisual kind={visual} />
                    </SlideIn>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS — ZIGZAG TIMELINE ============ */}
      {/* 스텝도 중앙 타임라인 기준 좌우 교차로 배치해 지그재그 톤 유지. */}
      <section className="border-b bg-muted/30">
        <div className="container py-20 sm:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">
              작동 방식
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              세 단계로 끝
            </h2>
          </Reveal>

          <div className="relative mx-auto mt-16 max-w-3xl">
            {/* 중앙 세로 타임라인 (md+) */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-border to-transparent md:block"
            />
            <div className="flex flex-col gap-10 sm:gap-14">
              {STEPS.map(({ icon: Icon, no, title, description }, i) => {
                const leftSide = i % 2 === 0;
                return (
                  <div
                    key={no}
                    className="relative grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]"
                  >
                    {/* 카드 셀 (좌 또는 우) */}
                    <SlideIn
                      from={leftSide ? "left" : "right"}
                      className={cn(
                        "md:col-span-1",
                        leftSide ? "md:order-1" : "md:order-3 md:text-right"
                      )}
                    >
                      <Card className="p-6">
                        <div
                          className={cn(
                            "flex items-center gap-3",
                            !leftSide && "md:flex-row-reverse"
                          )}
                        >
                          <span className="grid size-12 shrink-0 place-items-center rounded-xl border-2 border-brand/30 bg-background text-brand">
                            <Icon className="size-6" aria-hidden="true" />
                          </span>
                          <h3 className="text-lg font-semibold text-foreground">
                            {title}
                          </h3>
                        </div>
                        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      </Card>
                    </SlideIn>

                    {/* 타임라인 노드 (중앙) */}
                    <div className="z-10 hidden md:order-2 md:flex md:justify-center">
                      <span className="grid size-11 place-items-center rounded-full border-2 border-brand/30 bg-background text-base font-black tabular-nums text-brand">
                        {no}
                      </span>
                    </div>

                    {/* 반대편 빈 셀 (균형용) */}
                    <div
                      aria-hidden="true"
                      className={cn(
                        "hidden md:block",
                        leftSide ? "md:order-3" : "md:order-1"
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ============ CARD-NEWS SPOTLIGHT — OFFSET SPLIT ============ */}
      <section className="border-b">
        <div className="container grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <SlideIn from="left" className="flex flex-col items-start gap-5">
            <Badge variant="channel-instagram" className="px-3 py-1">
              <Sparkles className="size-3.5" aria-hidden="true" />
              PostOne만의 차별점
            </Badge>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              본문 작성, 카드뉴스 완성
            </h2>
            <p className="max-w-md text-balance text-lg text-muted-foreground">
              문단의 슬라이드 분할, 표지부터 마무리까지 디자인 적용한 인스타
              캐러셀 자동 구성. 당신의 역할은 글쓰기뿐.
            </p>
          </SlideIn>

          <SlideIn from="right" delay={120}>
            <div className="rounded-3xl border bg-card/60 p-6 shadow-sm sm:p-10">
              <BodyToCards />
            </div>
          </SlideIn>
        </div>
      </section>

      {/* ============ PRICING / FREE — ZIGZAG SPLIT ============ */}
      <section id="pricing" className="scroll-mt-16 border-b bg-muted/30">
        <div className="container grid items-center gap-12 py-20 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          {/* 액션 카드를 좌측에 두어 직전 섹션과 좌우를 반전 */}
          <SlideIn from="left" delay={120} className="lg:order-2">
            <Card className="p-7 sm:p-8">
              <ul className="mb-6 flex flex-col gap-3">
                {["전 기능 무료 개방", "카드 등록 불필요", "즉시 시작 가능"].map(
                  (item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2.5 text-[15px] font-medium text-foreground"
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success/12 text-success">
                        <Check className="size-3.5" aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  )
                )}
              </ul>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className={cn(buttonVariants({ size: "lg" }), "group flex-1 gap-2")}
                >
                  무료로 시작
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="/signup"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "flex-1"
                  )}
                >
                  베타 신청
                </Link>
              </div>
            </Card>
          </SlideIn>

          <SlideIn from="right" className="flex flex-col items-start gap-5 lg:order-1">
            <Badge variant="success" className="px-3 py-1">
              <Sparkles className="size-3.5" aria-hidden="true" />
              현재 무료
            </Badge>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              부담 없는 선체험
            </h2>
            <p className="max-w-lg text-balance text-lg text-muted-foreground">
              베타 기간 전 기능 무료 개방. 카드 없는 즉시 시작, 만족 시 지속 사용.
            </p>
          </SlideIn>
        </div>
      </section>

      {/* ===================== FINAL CTA — BRAND BANNER ===================== */}
      <section className="container py-20 sm:py-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-accent px-6 py-16 text-center shadow-lg sm:px-12 sm:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,rgba(255,255,255,0.25),transparent_50%)]"
            />
            <div className="relative">
              <h2 className="text-balance text-3xl font-extrabold tracking-tight text-brand-foreground sm:text-4xl lg:text-5xl">
                글 쓰는 시간만 남기기
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-brand-foreground/85">
                발행도, 카드뉴스도 PostOne의 몫. 오늘 쓴 글로 세 채널 채우기.
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
