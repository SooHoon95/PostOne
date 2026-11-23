"use server";

import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  refreshConnectionForUser,
  type RefreshableChannel,
} from "./token-core";

export type Channel = RefreshableChannel;
export type RefreshResult = {
  ok: boolean;
  expiresAt?: string;
  error?: string;
};

// 실제 갱신 로직은 lib/connections/token-core — 세션 없이 도는 cron 도 같은
// 코어를 사용한다. 이 액션은 사용자 세션 확인 + 캐시 무효화만 담당한다.
export async function refreshConnection(
  channel: Channel
): Promise<RefreshResult> {
  const user = await requireUser();
  const supabase = createClient();

  const result = await refreshConnectionForUser({
    supabase,
    userId: user.id,
    channel,
  });

  if (result.ok) revalidatePath("/settings/connections");
  return result;
}
