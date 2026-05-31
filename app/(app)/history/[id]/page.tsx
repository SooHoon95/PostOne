import { requireUser } from "@/lib/auth/get-user";
import { getPostById, getPostsByBatch } from "@/lib/posts/queries";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ChannelBadge, type Channel } from "@/components/channel-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import type { Post } from "@/lib/supabase/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "발행 상세",
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

/** 발행 본문: 텍스트 채널(linkedin/threads) 우선, 없으면 instagram content. */
function pickBody(posts: Post[]): string {
  const text = posts.find((p) => p.channel !== "instagram");
  return ((text ?? posts[0])?.content ?? "").trim();
}

/** 인스타 결과의 이미지 썸네일 캐러셀. */
function MediaCarousel({ urls }: { urls: string[] }) {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto">
      {urls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt=""
          className="size-24 shrink-0 rounded-md border border-border object-cover"
        />
      ))}
    </div>
  );
}

/** 채널별 발행 결과 카드. */
function ChannelResultCard({ post }: { post: Post }) {
  const channel = asChannel(post.channel);
  const succeeded = post.status === "success";
  return (
    <Card className="p-5">
      <div className="flex items-center gap-1.5">
        {channel ? <ChannelBadge channel={channel} size="sm" /> : null}
        <span className="text-sm font-medium text-foreground">
          {channel ? channelLabels[channel] : post.channel.toUpperCase()}
        </span>
        <Badge variant={succeeded ? "success" : "destructive"} dot>
          {succeeded ? "발행됨" : "실패"}
        </Badge>
      </div>

      {succeeded ? (
        post.external_id && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {post.external_id}
          </p>
        )
      ) : (
        post.error_message && (
          <p className="mt-2 text-xs text-destructive">{post.error_message}</p>
        )
      )}

      {post.channel === "instagram" &&
        post.media_urls &&
        post.media_urls.length > 0 && <MediaCarousel urls={post.media_urls} />}
    </Card>
  );
}

export default async function HistoryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  const post = await getPostById(user.id, params.id);
  if (!post) notFound();

  const posts = post.batch_id
    ? await getPostsByBatch(user.id, post.batch_id)
    : [post];

  const body = pickBody(posts);
  const publishedAt = posts.reduce((a, b) =>
    a.created_at > b.created_at ? a : b
  ).created_at;

  return (
    <div className="space-y-8">
      <PageHeader
        title="발행 상세"
        description={new Date(publishedAt).toLocaleString("ko-KR")}
      >
        <Link
          href="/history"
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <ArrowLeft className="size-4" />
          목록으로
        </Link>
      </PageHeader>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">본문</h2>
        <Card className="p-5">
          {body ? (
            <p className="whitespace-pre-wrap text-sm text-foreground">{body}</p>
          ) : (
            <p className="text-sm text-muted-foreground">본문 없음</p>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">채널별 결과</h2>
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <ChannelResultCard post={p} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
