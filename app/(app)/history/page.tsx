import { requireUser } from "@/lib/auth/get-user";
import { getRecentPosts, getRecentPostsByChannel } from "@/lib/posts/queries";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ChannelBadge, type Channel } from "@/components/channel-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, PenLine } from "lucide-react";
import type { Post } from "@/lib/supabase/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "발행 이력",
  description: "최근 발행한 글을 채널별로 확인하세요.",
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

type Filter = "all" | Channel;

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "threads", label: "Threads" },
  { value: "instagram", label: "Instagram" },
];

function asFilter(value: string | undefined): Filter {
  return value === "linkedin" || value === "threads" || value === "instagram"
    ? value
    : "all";
}

/** 채널 단일 상태 배지: 채널 글리프 + 성공/실패 라벨. */
function ChannelStatus({ post }: { post: Post }) {
  const channel = asChannel(post.channel);
  const succeeded = post.status === "success";
  return (
    <div className="flex items-center gap-1.5">
      {channel ? <ChannelBadge channel={channel} size="sm" /> : null}
      <span className="text-sm font-medium text-foreground">
        {channel ? channelLabels[channel] : post.channel.toUpperCase()}
      </span>
      <Badge variant={succeeded ? "success" : "destructive"} dot>
        {succeeded ? "발행됨" : "실패"}
      </Badge>
    </div>
  );
}

/** 단일 post 카드 (채널 탭 + null batch 단건). */
function PostCard({ post }: { post: Post }) {
  const succeeded = post.status === "success";
  return (
    <Link href={`/history/${post.id}`} className="block">
      <Card interactive className="p-5">
        <div className="flex items-center justify-between gap-3">
          <ChannelStatus post={post} />
          <time className="shrink-0 text-xs text-muted-foreground">
            {new Date(post.created_at).toLocaleString("ko-KR")}
          </time>
        </div>

        <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
          {post.content}
        </p>

        {succeeded
          ? post.external_id && (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {post.external_id}
              </p>
            )
          : post.error_message && (
              <p className="mt-2 text-xs text-destructive">
                {post.error_message}
              </p>
            )}
      </Card>
    </Link>
  );
}

/** 묶음 카드: 본문 1개 + 채널별 상태 배지 묶음. */
function BatchCard({ posts }: { posts: Post[] }) {
  // 묶음 본문은 LinkedIn/Threads 기준(동일 body). 없으면 첫 post 내용.
  const primary =
    posts.find((p) => p.channel !== "instagram") ?? posts[0];
  const latest = posts.reduce((a, b) =>
    a.created_at > b.created_at ? a : b
  );
  return (
    <Link href={`/history/${primary.id}`} className="block">
      <Card interactive className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {posts.map((p) => (
              <ChannelStatus key={p.id} post={p} />
            ))}
          </div>
          <time className="shrink-0 text-xs text-muted-foreground">
            {new Date(latest.created_at).toLocaleString("ko-KR")}
          </time>
        </div>

        <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
          {primary.content}
        </p>
      </Card>
    </Link>
  );
}

/** 전체 탭 행: 묶음(2+ posts) 또는 단건. */
type HistoryRow =
  | { type: "batch"; key: string; posts: Post[]; createdAt: string }
  | { type: "single"; key: string; post: Post; createdAt: string };

function groupPosts(posts: Post[]): HistoryRow[] {
  const batches: Record<string, Post[]> = {};
  const rows: HistoryRow[] = [];

  for (const p of posts) {
    if (p.batch_id) {
      const list = batches[p.batch_id];
      if (list) {
        list.push(p);
      } else {
        batches[p.batch_id] = [p];
      }
    } else {
      rows.push({
        type: "single",
        key: p.id,
        post: p,
        createdAt: p.created_at,
      });
    }
  }

  for (const batchId of Object.keys(batches)) {
    const group = batches[batchId];
    // 1개짜리 묶음(단일 채널 멀티발행)도 묶음 카드로 일관 표시.
    const createdAt = group.reduce<string>(
      (max, p) => (p.created_at > max ? p.created_at : max),
      group[0].created_at
    );
    rows.push({ type: "batch", key: batchId, posts: group, createdAt });
  }

  rows.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  return rows;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { channel?: string };
}) {
  const user = await requireUser();
  const filter = asFilter(searchParams.channel);

  const posts =
    filter === "all"
      ? await getRecentPosts(user.id, 30)
      : await getRecentPostsByChannel(user.id, filter, 30);

  const rows = filter === "all" ? groupPosts(posts) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="발행 이력"
        description="최근 발행한 글을 채널별로 확인하세요."
      />

      <nav className="flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const active = f.value === filter;
          return (
            <Link
              key={f.value}
              href={f.value === "all" ? "/history" : `/history?channel=${f.value}`}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {posts.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="아직 발행한 글이 없습니다"
          description="첫 글을 작성하면 발행 결과가 여기에 표시됩니다."
          action={
            <Link href="/compose" className={cn(buttonVariants(), "gap-1.5")}>
              <PenLine className="size-4" />
              글쓰기
            </Link>
          }
        />
      ) : filter === "all" ? (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.key}>
              {row.type === "batch" ? (
                <BatchCard posts={row.posts} />
              ) : (
                <PostCard post={row.post} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <PostCard post={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
