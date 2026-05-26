import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const user = await requireUser();
  const supabase = createClient();
  const { data: connection } = await supabase
    .from("linkedin_connections")
    .select("linkedin_sub, expires_at, scope")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">채널 연동</h1>

      {searchParams.connected && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          LinkedIn이 성공적으로 연결되었습니다.
        </p>
      )}
      {searchParams.error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          오류: {searchParams.error}
        </p>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">LinkedIn</h2>
            {connection ? (
              <p className="mt-1 text-sm text-slate-600">
                연결됨 · 만료:{" "}
                {new Date(connection.expires_at).toLocaleDateString("ko-KR")}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                아직 연결되지 않았습니다.
              </p>
            )}
          </div>
          <form action="/api/linkedin/oauth/start" method="GET">
            <Button type="submit">{connection ? "재연결" : "연결하기"}</Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
