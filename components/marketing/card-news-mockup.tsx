import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pure CSS/JSX mockup of an auto-generated Instagram card-news carousel.
 * No real images — each square card is composed from tokens plus the one
 * sanctioned exception: the Instagram brand gradient (defined inline below).
 */

type Slide = {
  /** 1-based index shown on the slide. */
  step: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Visual treatment for the square art area. */
  tone: "cover" | "point" | "list" | "outro";
};

const SLIDES: Slide[] = [
  {
    step: "01",
    eyebrow: "퍼스널 브랜딩",
    title: "글 하나로\n세 채널 동시에",
    body: "본문을 쓰면 카드뉴스까지 자동으로",
    tone: "cover",
  },
  {
    step: "02",
    eyebrow: "POINT 1",
    title: "다시 안 써도\n됩니다",
    body: "채널마다 복붙하던 시간을 글쓰기에",
    tone: "point",
  },
  {
    step: "03",
    eyebrow: "POINT 2",
    title: "본문이 곧\n카드가 된다",
    body: "문단을 슬라이드로 자동 분할",
    tone: "list",
  },
  {
    step: "04",
    eyebrow: "이제 시작",
    title: "오늘부터\n꾸준하게",
    body: "PostOne으로 무료 시작",
    tone: "outro",
  },
];

/** Instagram brand gradient — sanctioned token exception. */
const IG_GRADIENT =
  "linear-gradient(135deg, #FEDA75 0%, #FA7E1E 25%, #D62976 55%, #962FBF 80%, #4F5BD5 100%)";

function SlideArt({ tone }: { tone: Slide["tone"] }) {
  switch (tone) {
    case "cover":
      return (
        <div className="flex h-full flex-col justify-between p-5 text-white">
          <span
            className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide backdrop-blur"
            style={{ backgroundColor: "rgba(255,255,255,0.22)" }}
          >
            CARD NEWS
          </span>
          <div className="space-y-1.5">
            <div className="h-2 w-3/4 rounded-full bg-white/85" />
            <div className="h-2 w-1/2 rounded-full bg-white/55" />
          </div>
        </div>
      );
    case "point":
      return (
        <div className="flex h-full flex-col justify-center gap-3 p-5 text-white">
          <div className="text-5xl font-black leading-none">“</div>
          <div className="space-y-2">
            <div className="h-2.5 w-5/6 rounded-full bg-white/85" />
            <div className="h-2.5 w-2/3 rounded-full bg-white/60" />
          </div>
        </div>
      );
    case "list":
      return (
        <div className="flex h-full flex-col justify-center gap-3 p-5 text-white">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-md bg-white/25 text-[10px] font-bold">
                {i + 1}
              </span>
              <span
                className="h-2 rounded-full bg-white/70"
                style={{ width: `${72 - i * 14}%` }}
              />
            </div>
          ))}
        </div>
      );
    case "outro":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-white">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/20 text-xl font-black">
            ✓
          </span>
          <div className="h-2 w-2/3 rounded-full bg-white/80" />
        </div>
      );
  }
}

function CardFace({ slide }: { slide: Slide }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.25rem] border border-white/15 bg-card shadow-2xl">
      {/* IG-style header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span
          className="size-6 rounded-full p-[1.5px]"
          style={{ background: IG_GRADIENT }}
        >
          <span className="block size-full rounded-full bg-card" />
        </span>
        <span className="text-[11px] font-semibold text-foreground">
          @your.handle
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {slide.step}/04
        </span>
      </div>

      {/* Square visual */}
      <div
        className="relative aspect-square w-full"
        style={{ background: IG_GRADIENT }}
      >
        {/* soft vignette using token-free white overlays only */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
        <div className="relative z-10 h-full">
          <SlideArt tone={slide.tone} />
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-1 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
          {slide.eyebrow}
        </p>
        <p className="whitespace-pre-line text-[13px] font-bold leading-tight text-foreground">
          {slide.title}
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {slide.body}
        </p>
      </div>
    </div>
  );
}

export interface CardNewsMockupProps {
  className?: string;
}

/**
 * Fanned stack of square Instagram cards. The lead card sits front-and-center;
 * the rest cascade behind it with rotation + offset to read as a swipeable
 * carousel deck.
 */
export function CardNewsMockup({ className }: CardNewsMockupProps) {
  // Back-to-front so the lead card paints last (on top).
  const layers = [
    { i: 3, x: "26%", y: "9%", rot: 9, scale: 0.9, z: 10, dim: "opacity-70" },
    { i: 2, x: "13%", y: "4.5%", rot: 5, scale: 0.95, z: 20, dim: "opacity-90" },
    { i: 1, x: "0%", y: "0%", rot: 0, scale: 1, z: 30, dim: "" },
  ];

  return (
    <div
      className={cn(
        "relative mx-auto aspect-[4/5] w-full max-w-sm select-none",
        className
      )}
      aria-hidden="true"
    >
      {/* Brand glow behind the deck */}
      <div className="absolute inset-0 -z-10 scale-110 rounded-[2rem] bg-brand/20 blur-3xl dark:bg-brand/25" />

      {layers.map(({ i, x, y, rot, scale, z, dim }) => (
        <div
          key={i}
          className={cn("absolute inset-0", dim)}
          style={{
            transform: `translate(${x}, ${y}) rotate(${rot}deg) scale(${scale})`,
            transformOrigin: "bottom left",
            zIndex: z,
          }}
        >
          <CardFace slide={SLIDES[i]} />
        </div>
      ))}

      {/* Carousel dots */}
      <div className="absolute -bottom-7 left-1/2 z-40 flex -translate-x-1/2 gap-1.5">
        {SLIDES.map((_, idx) => (
          <span
            key={idx}
            className={cn(
              "size-1.5 rounded-full",
              idx === 0 ? "w-4 bg-brand" : "bg-foreground/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}
