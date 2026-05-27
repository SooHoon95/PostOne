import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/get-user";
import { exchangeCodeForToken, fetchUserInfo } from "@/lib/linkedin/oauth";
import { encryptToken } from "@/lib/crypto/encrypt";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/connections?error=${error}`, process.env.NEXT_PUBLIC_APP_URL ?? request.url)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/connections?error=missing_params", process.env.NEXT_PUBLIC_APP_URL ?? request.url)
    );
  }

  const cookieState = cookies().get("linkedin_oauth_state")?.value;
  if (state !== cookieState) {
    return NextResponse.redirect(
      new URL("/settings/connections?error=state_mismatch", process.env.NEXT_PUBLIC_APP_URL ?? request.url)
    );
  }

  let token, info;
  try {
    token = await exchangeCodeForToken(code);
    info = await fetchUserInfo(token.access_token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      new URL(
        `/settings/connections?error=${encodeURIComponent(msg)}`,
        process.env.NEXT_PUBLIC_APP_URL ?? request.url
      )
    );
  }

  const enc = encryptToken(token.access_token);
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);

  const supabase = createClient();
  const { error: dbError } = await supabase.from("linkedin_connections").upsert(
    {
      user_id: user.id,
      linkedin_sub: info.sub,
      access_token_ciphertext: enc.ciphertext,
      access_token_iv: enc.iv,
      access_token_tag: enc.tag,
      expires_at: expiresAt.toISOString(),
      scope: token.scope,
    },
    { onConflict: "user_id" }
  );

  if (dbError) {
    return NextResponse.redirect(
      new URL(
        `/settings/connections?error=${encodeURIComponent(dbError.message)}`,
        process.env.NEXT_PUBLIC_APP_URL ?? request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL("/settings/connections?connected=1", process.env.NEXT_PUBLIC_APP_URL ?? request.url)
  );
}
