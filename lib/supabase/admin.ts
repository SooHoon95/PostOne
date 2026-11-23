import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * service role 클라이언트 — 서버(route handler · cron)에서만 사용한다.
 * 세션 쿠키가 없는 cron 은 RLS 를 우회해야 예약 행을 claim/갱신할 수 있다.
 * 이 파일은 서버 컴포넌트·서버 액션·route handler 밖에서 import 하지 않는다.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY(또는 NEXT_PUBLIC_SUPABASE_URL)가 설정되지 않았습니다."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
