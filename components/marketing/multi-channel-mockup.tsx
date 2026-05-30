import { ChannelBadge, type Channel } from "@/components/channel-badge";
import { cn } from "@/lib/utils";

/**
 * Hero visual: ONE body, written once, fans out into THREE equal channel
 * outputs. Multi-channel publishing is the protagonist — the three channels
 * read as equal-weight results, and Instagram's card-news is just one of them
 * (a small gradient thumbnail), not the headline.
 *
 * Tokens only; the single sanctioned exception is the Instagram brand gradient.
 */

const CHANNELS: { channel: Channel; label: string }[] = [
  { channel: "linkedin", label: "LinkedIn" },
  { channel: "threads", label: "Threads" },
  { channel: "instagram", label: "Instagram" },
];

export interface MultiChannelMockupProps {
  className?: string;
}

export function MultiChannelMockup({ className }: MultiChannelMockupProps) {
  return (
    <div
      className={cn("relative mx-auto w-full max-w-sm", className)}
      aria-hidden="true"
    >
      {/* brand glow */}
      <div className="absolute inset-0 -z-10 scale-105 rounded-[2.5rem] bg-brand/20 blur-3xl dark:bg-brand/25" />

      <div className="flex flex-col gap-4 rounded-3xl border bg-card/80 p-5 shadow-2xl backdrop-blur-sm">
        {/* SOURCE — written once */}
        <div className="rounded-2xl border border-brand/20 bg-brand/[0.06] p-4">
          <span className="inline-flex items-center rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-brand-foreground">
            본문 한 번
          </span>
          <div className="mt-3 space-y-1.5">
            <span className="block h-2 w-[88%] rounded-full bg-foreground/70" />
            <span className="block h-2 w-[58%] rounded-full bg-muted-foreground/30" />
          </div>
        </div>

        {/* split */}
        <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          세 채널 동시 발행
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* OUTPUTS — three equal results */}
        <div className="grid grid-cols-3 gap-2.5">
          {CHANNELS.map(({ channel, label }) => (
            <div
              key={channel}
              className="flex flex-col items-center gap-2 rounded-xl border bg-card p-2.5"
            >
              <ChannelBadge channel={channel} size="md" />
              <span className="text-[10px] font-semibold text-foreground">
                {label}
              </span>
              {channel === "instagram" ? (
                <div className="aspect-square w-full rounded-md bg-[linear-gradient(135deg,#FEDA75_0%,#D62976_55%,#4F5BD5_100%)]" />
              ) : (
                <div className="w-full space-y-1 pt-1">
                  <span className="block h-1.5 w-full rounded-full bg-muted-foreground/25" />
                  <span className="block h-1.5 w-2/3 rounded-full bg-muted-foreground/25" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
