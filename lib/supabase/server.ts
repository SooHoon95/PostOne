import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, withRememberPolicy } from "./cookie-options";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const remember = cookieStore.get(REMEMBER_COOKIE)?.value;
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, withRememberPolicy(options, remember))
            );
          } catch {
            // Server Component에서 호출된 경우 — 미들웨어가 처리하므로 무시
          }
        },
      },
    }
  );
}
