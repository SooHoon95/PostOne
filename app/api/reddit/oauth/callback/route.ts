import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/get-user";
import {
  exchangeCodeForToken,
  fetchUserInfo,
  REDDIT_SCOPES,
} from "@/lib/reddit/oauth";
import { encryptToken } from "@/lib/crypto/encrypt";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.url;

  function redirect(path: string) {
    return NextResponse.redirect(new URL(path, base));
  }

  if (error) {
    return redirect(`/settings/connections?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return redirect("/settings/connections?error=missing_params");
  }

  const cookieState = cookies().get("reddit_oauth_state")?.value;
  if (state !== cookieState) {
    return redirect("/settings/connections?error=state_mismatch");
  }

  try {
    const token = await exchangeCodeForToken(code);
    // duration=permanent 로 요청하므로 refresh_token 이 반드시 와야 한다.
    if (!token.refresh_token) {
      return redirect("/settings/connections?error=no_refresh_token");
    }

    const me = await fetchUserInfo(token.access_token);

    const accessEnc = encryptToken(token.access_token);
    const refreshEnc = encryptToken(token.refresh_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);

    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("reddit_connections")
      .upsert(
        {
          user_id: user.id,
          reddit_user_id: me.id ?? null,
          reddit_username: me.name,
          access_token_ciphertext: accessEnc.ciphertext,
          access_token_iv: accessEnc.iv,
          access_token_tag: accessEnc.tag,
          refresh_token_ciphertext: refreshEnc.ciphertext,
          refresh_token_iv: refreshEnc.iv,
          refresh_token_tag: refreshEnc.tag,
          expires_at: expiresAt.toISOString(),
          scope: token.scope ?? REDDIT_SCOPES.join(" "),
        },
        { onConflict: "user_id" }
      );

    if (dbError) {
      return redirect(
        `/settings/connections?error=${encodeURIComponent(dbError.message)}`
      );
    }

    const response = redirect("/settings/connections?connected=reddit");
    response.cookies.delete("reddit_oauth_state");
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return redirect(`/settings/connections?error=${encodeURIComponent(msg)}`);
  }
}
