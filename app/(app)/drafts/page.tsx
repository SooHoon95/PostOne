import { loadDraft, deleteDraft } from "@/lib/drafts/actions";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ChannelBadge, type Channel } from "@/components/channel-badge";
import { cn } from "@/lib/utils";
import { FileText, PenLine, Layers } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "저장된 글",
  description: "작성 중인 글을 이어서 발행하세요.",
};

const channelLabels: Record<Channel, string> = {
  linkedin: "LinkedIn",
  threads: "Threads",
  instagram: "Instagram",
};

function asChannel(value: string): Channel | null {
  return value === "linkedin" || value === "threads" || value === "instagram"
    ? value
    : null;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

const PREVIEW_LEN = 160;

async function discardDraft() {
  "use server";
  await deleteDraft();
  revalidatePath("/drafts");
}

export default async function DraftsPage() {
  const draft = await loadDraft();
  const isEmpty =
    !draft ||
    (draft.body.trim().length === 0 &&
      draft.instagramCards.length === 0 &&
      draft.selectedChannels.length === 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="저장된 글"
        description="작성 중인 글을 이어서 발행하세요."
      />

      {isEmpty ? (
        <EmptyState
          icon={<FileText />}
          title="저장된 글 없음"
          description="글쓰기에서 작성한 내용은 자동으로 저장되어 여기에서 이어서 발행할 수 있습니다."
          action={
            <Link href="/compose" className={cn(buttonVariants(), "gap-1.5")}>
              <PenLine className="size-4" />
              글쓰기
            </Link>
          }
        />
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {draft.selectedChannels.length > 0 ? (
                draft.selectedChannels.map((c) => {
                  const channel = asChannel(c);
                  return channel ? (
                    <span key={c} className="flex items-center gap-1">
                      <ChannelBadge channel={channel} size="sm" />
                      <span className="text-sm text-muted-foreground">
                        {channelLabels[channel]}
                      </span>
                    </span>
                  ) : null;
                })
              ) : (
                <Badge variant="secondary">채널 미선택</Badge>
              )}
            </div>
            {draft.updatedAt ? (
              <time className="shrink-0 text-xs text-muted-foreground">
                {relativeTime(draft.updatedAt)}
              </time>
            ) : null}
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
            {draft.body.trim().length > 0
              ? draft.body.slice(0, PREVIEW_LEN) +
                (draft.body.length > PREVIEW_LEN ? "…" : "")
              : "(본문 없음)"}
          </p>

          {draft.instagramCards.length > 0 ? (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="size-3.5" />
              카드 {draft.instagramCards.length}장
            </p>
          ) : null}

          <div className="mt-5 flex items-center gap-2">
            <Link
              href="/compose?continue=1"
              className={cn(buttonVariants(), "gap-1.5")}
            >
              <PenLine className="size-4" />
              이어쓰기
            </Link>
            <form action={discardDraft}>
              <Button type="submit" variant="outline" size="default">
                삭제
              </Button>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
