import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  name,
  description,
  connection,
  startUrl,
}: {
  name: string;
  description: string;
  connection: ConnectionRow | null;
  startUrl: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {connection
              ? `연결됨${connection.username ? ` · @${connection.username}` : ""} · 만료: ${new Date(
                  connection.expires_at
                ).toLocaleDateString("ko-KR")}`
              : description}
          </p>
        </div>
        <form action={startUrl} method="GET">
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">채널 연동</h1>

      {connectedLabel && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {connectedLabel} 이(가) 성공적으로 연결되었습니다.
        </p>
      )}
      {searchParams.error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          오류: {decodeURIComponent(searchParams.error)}
        </p>
      )}

      <ChannelCard
        name="LinkedIn"
        description="공식 API · 텍스트 최대 3000자"
        connection={conns.linkedin}
        startUrl="/api/linkedin/oauth/start"
      />
      <ChannelCard
        name="Threads"
        description="공식 API · 텍스트 최대 500자"
        connection={conns.threads}
        startUrl="/api/threads/oauth/start"
      />
      <ChannelCard
        name="Instagram"
        description="비즈니스 계정 + Facebook Page 연결 필요 · 카드 이미지 자동 생성"
        connection={conns.instagram}
        startUrl="/api/instagram/oauth/start"
      />
    </div>
  );
}
