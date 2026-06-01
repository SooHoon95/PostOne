import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  // 이메일 미인증 세션 차단 (방어막 — 핵심 차단은 Supabase "Confirm email" 설정)
  if (!user.email_confirmed_at) redirect("/verify-email");
  return user;
}
