import { requireUser } from "@/lib/auth/get-user";
import { getRecentPosts } from "@/lib/posts/queries";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ChannelBadge, type Channel } from "@/components/channel-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, PenLine } from "lucide-react";

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

export default async function HistoryPage() {
  const user = await requireUser();
  const posts = await getRecentPosts(user.id, 30);

  return (
    <div className="space-y-8">
      <PageHeader
        title="발행 이력"
        description="최근 발행한 글을 채널별로 확인하세요."
      />

      {posts.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="아직 발행한 글이 없습니다"
          description="첫 글을 작성하면 발행 결과가 여기에 표시됩니다."
          action={
            <Link
              href="/compose"
              className={cn(buttonVariants(), "gap-1.5")}
            >
              <PenLine className="size-4" />
              글쓰기
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => {
            const channel = asChannel(p.channel);
            const succeeded = p.status === "success";
            return (
              <li key={p.id}>
                <Card interactive className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {channel ? (
                        <ChannelBadge channel={channel} size="sm" />
                      ) : null}
                      <span className="text-sm font-medium text-foreground">
                        {channel ? channelLabels[channel] : p.channel.toUpperCase()}
                      </span>
                      <Badge
                        variant={succeeded ? "success" : "destructive"}
                        dot
                      >
                        {succeeded ? "발행됨" : "실패"}
                      </Badge>
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleString("ko-KR")}
                    </time>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                    {p.content}
                  </p>

                  {succeeded
                    ? p.external_id && (
                        <p className="mt-2 font-mono text-xs text-muted-foreground">
                          {p.external_id}
                        </p>
                      )
                    : p.error_message && (
                        <p className="mt-2 text-xs text-destructive">
                          {p.error_message}
                        </p>
                      )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
