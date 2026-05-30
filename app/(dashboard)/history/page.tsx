import { requireUser } from "@/lib/auth/get-user";
import { getRecentPosts } from "@/lib/posts/queries";
import { Card } from "@/components/ui/card";

export default async function HistoryPage() {
  const user = await requireUser();
  const posts = await getRecentPosts(user.id, 30);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">발행 이력</h1>
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 발행한 글이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Card className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.channel.toUpperCase()}</span>
                  <span>{new Date(p.created_at).toLocaleString("ko-KR")}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{p.content}</p>
                <p
                  className={`mt-2 text-xs ${
                    p.status === "success" ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {p.status === "success"
                    ? `✓ ${p.external_id ?? ""}`
                    : `✗ ${p.error_message ?? ""}`}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
