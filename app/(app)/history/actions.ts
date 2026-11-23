"use server";

import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { cancelScheduledPostForUser } from "@/lib/scheduling/queries";
import { revalidatePath } from "next/cache";

/** 발행 이력의 예약 항목 취소 — scheduled 상태에서만 가능. */
export async function cancelScheduledPost(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const user = await requireUser();
  const supabase = createClient();

  await cancelScheduledPostForUser({ supabase, userId: user.id, id });
  revalidatePath("/history");
}
