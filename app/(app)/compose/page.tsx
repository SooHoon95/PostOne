import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { MultiChannelEditor } from "@/components/multi-channel-editor";
import { publishMulti } from "./actions";

// Vercel: Instagram 캐러셀 + 카드 생성은 시간이 걸려서 60초까지 허용
export const maxDuration = 60;

export default async function ComposePage() {
  const user = await requireUser();
  const supabase = createClient();

  const [linkedin, threads, instagram] = await Promise.all([
    supabase
      .from("linkedin_connections")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("threads_connections")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("instagram_connections")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const connectedChannels = {
    linkedin: !!linkedin.data,
    threads: !!threads.data,
    instagram: !!instagram.data,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">글쓰기</h1>
      <MultiChannelEditor
        publish={publishMulti}
        connectedChannels={connectedChannels}
      />
    </div>
  );
}
