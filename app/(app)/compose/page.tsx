import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { MultiChannelEditor } from "@/components/multi-channel-editor";
import { publishMulti, createCardBgUpload } from "./actions";
import { saveDraft, loadDraft, deleteDraft } from "@/lib/drafts/actions";

// Vercel: Instagram 캐러셀 + 카드 생성은 시간이 걸려서 60초까지 허용
export const maxDuration = 60;

export default async function ComposePage({
  searchParams,
}: {
  searchParams: { continue?: string };
}) {
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

  const initialDraft = await loadDraft();
  // /drafts "이어쓰기"는 ?continue=1로 진입 → 저장된 글을 폼에 바로 채운다.
  const autoContinue = searchParams?.continue === "1" && !!initialDraft;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">글쓰기</h1>
      <MultiChannelEditor
        publish={publishMulti}
        uploadBackground={createCardBgUpload}
        connectedChannels={connectedChannels}
        initialDraft={initialDraft}
        autoContinue={autoContinue}
        saveDraft={saveDraft}
        deleteDraft={deleteDraft}
      />
    </div>
  );
}
