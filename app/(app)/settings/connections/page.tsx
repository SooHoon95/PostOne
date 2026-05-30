import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { ChannelBadge, type Channel } from "@/components/channel-badge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "채널 연동",
  description: "LinkedIn · Threads · Instagram 계정을 연결하세요.",
};

type ConnectionRow = {
  expires_at: string;
  username?: string | null;
};

async function loadConnections(userId: string) {
  const supabase = createClient();
  const [linkedin, threads, instagram] = await Promise.all([
    supabase
      .from("linkedin_connections")
      .select("expires_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("threads_connections")
      .select("expires_at, username")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("instagram_connections")
      .select("expires_at, username")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  return {
    linkedin: linkedin.data as ConnectionRow | null,
    threads: threads.data as ConnectionRow | null,
    instagram: instagram.data as ConnectionRow | null,
  };
}

function ChannelCard({
  channel,
  name,
  description,
  connection,
  startUrl,
}: {
  channel: Channel;
  name: string;
  description: string;
  connection: ConnectionRow | null;
  startUrl: string;
}) {
  return (
    <Card interactive className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <ChannelBadge channel={channel} size="lg" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-foreground">{name}</h2>
              {connection ? (
                <Badge variant="success" dot>
                  연결됨
                </Badge>
              ) : (
                <Badge variant="outline">미연결</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {connection
                ? `${connection.username ? `@${connection.username} · ` : ""}만료: ${new Date(
                    connection.expires_at
                  ).toLocaleDateString("ko-KR")}`
                : description}
            </p>
          </div>
        </div>
        <form action={startUrl} method="GET" className="shrink-0">
          <Button type="submit" variant={connection ? "outline" : "default"}>
            {connection ? "재연결" : "연결하기"}
          </Button>
        </form>
      </div>
    </Card>
  );
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const user = await requireUser();
  const conns = await loadConnections(user.id);

  const connectedLabel =
    searchParams.connected === "threads"
      ? "Threads"
      : searchParams.connected === "instagram"
      ? "Instagram"
      : searchParams.connected
      ? "LinkedIn"
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="채널 연동"
        description="연결한 채널로 글을 한 번에 발행할 수 있습니다."
      />

      {connectedLabel && (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription className="text-foreground">
            {connectedLabel} 이(가) 성공적으로 연결되었습니다.
          </AlertDescription>
        </Alert>
      )}
      {searchParams.error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-foreground">
            오류: {decodeURIComponent(searchParams.error)}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <ChannelCard
          channel="linkedin"
          name="LinkedIn"
          description="공식 API · 텍스트 최대 3000자"
          connection={conns.linkedin}
          startUrl="/api/linkedin/oauth/start"
        />
        <ChannelCard
          channel="threads"
          name="Threads"
          description="공식 API · 텍스트 최대 500자"
          connection={conns.threads}
          startUrl="/api/threads/oauth/start"
        />
        <ChannelCard
          channel="instagram"
          name="Instagram"
          description="비즈니스 계정 + Facebook Page 연결 필요 · 카드 이미지 자동 생성"
          connection={conns.instagram}
          startUrl="/api/instagram/oauth/start"
        />
      </div>
    </div>
  );
}
