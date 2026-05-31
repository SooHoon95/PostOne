import * as React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Instagram brand gradient — sanctioned token exception. */
const IG_GRADIENT =
  "linear-gradient(135deg, #FEDA75 0%, #FA7E1E 25%, #D62976 55%, #962FBF 80%, #4F5BD5 100%)";

const SOURCE_PARAGRAPHS = [
  "표지 · 퍼스널 브랜딩, 결국 꾸준함 싸움",
  "본문 1 · 채널마다 다시 쓰다 보면 발행이 미뤄진다",
  "마무리 · 카드 내용만 넣으면 디자인은 자동",
];

const GENERATED_CARDS = [
  { tag: "표지", line1: "w-3/4", line2: "w-1/2" },
  { tag: "본문 1", line1: "w-5/6", line2: "w-2/3" },
  { tag: "마무리", line1: "w-2/3", line2: "w-1/3" },
];

export interface BodyToCardsProps {
  className?: string;
}

/**
 * Side-by-side visual: per-card content the user types (left) is rendered into
 * a set of designed Instagram cards (right). Communicates the core PostOne
 * differentiator — you supply the words, PostOne does the design.
 */
export function BodyToCards({ className }: BodyToCardsProps) {
  return (
    <div
      className={cn(
        "grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]",
        className
      )}
    >
      {/* LEFT — source body */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-warning/80" />
            <span className="size-2.5 rounded-full bg-success/80" />
          </span>
          <span className="ml-1 text-xs font-medium text-muted-foreground">
            카드 내용 입력
          </span>
        </div>
        <p className="mb-3 text-sm font-semibold text-foreground">
          슬라이드별 제목·설명
        </p>
        <div className="space-y-3">
          {SOURCE_PARAGRAPHS.map((p) => (
            <p
              key={p}
              className="text-[13px] leading-relaxed text-muted-foreground"
            >
              {p}
            </p>
          ))}
        </div>
      </div>

      {/* MIDDLE — transform arrow */}
      <div className="flex items-center justify-center lg:flex-col lg:gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">
          <Sparkles className="size-3.5" aria-hidden="true" />
          자동 생성
        </div>
        <ArrowRight
          className="hidden size-5 text-brand lg:block lg:rotate-90"
          aria-hidden="true"
        />
        <ArrowRight className="size-5 text-brand lg:hidden" aria-hidden="true" />
      </div>

      {/* RIGHT — generated cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {GENERATED_CARDS.map((c) => (
          <div
            key={c.tag}
            className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm"
          >
            <div
              className="relative aspect-square"
              style={{ background: IG_GRADIENT }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_30%_20%,rgba(255,255,255,0.2),transparent_55%)]" />
              <div className="relative flex h-full flex-col justify-end gap-1.5 p-2.5">
                <span
                  className={cn("h-1.5 rounded-full bg-white/85", c.line1)}
                />
                <span
                  className={cn("h-1.5 rounded-full bg-white/55", c.line2)}
                />
              </div>
            </div>
            <p className="px-2 py-1.5 text-center text-[10px] font-medium text-muted-foreground">
              {c.tag}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
