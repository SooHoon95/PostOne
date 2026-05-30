// "로그인 상태 유지" 정책.
// signIn 시 pm_remember 플래그 쿠키를 심고, server/middleware 양쪽의
// Supabase auth 쿠키 setAll에서 이 값을 읽어 만료를 일관되게 적용한다.
//   "1"       → 30일 영속 쿠키
//   "0"       → 세션 쿠키(브라우저 종료 시 만료)
//   undefined → 기존 동작 유지(Supabase 기본 옵션 그대로)

export const REMEMBER_COOKIE = "pm_remember";
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

type MutableCookieOptions = {
  maxAge?: number;
  expires?: Date;
  [key: string]: unknown;
};

export function withRememberPolicy<T extends MutableCookieOptions | undefined>(
  options: T,
  rememberFlag: string | undefined
): MutableCookieOptions {
  const base: MutableCookieOptions = { ...(options ?? {}) };

  // 삭제용 쿠키(maxAge 0/음수)는 만료를 늘리지 않는다 — signOut 등에서 보존.
  if (typeof base.maxAge === "number" && base.maxAge <= 0) return base;

  // "1" → 30일 영속, "0" → 세션 쿠키. 그 외(undefined·변조값)는 기존 동작 유지.
  if (rememberFlag === "1") {
    return { ...base, maxAge: REMEMBER_MAX_AGE };
  }
  if (rememberFlag === "0") {
    // 세션 쿠키: 만료 지정을 제거하면 브라우저 종료 시 사라진다.
    delete base.maxAge;
    delete base.expires;
    return base;
  }
  return base;
}
