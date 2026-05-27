import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/get-user";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchUserInfo,
} from "@/lib/instagram/oauth";
import { encryptToken } from "@/lib/crypto/encrypt";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/connections?error=${error}`, request.url)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/connections?error=missing_params", request.url)
    );
  }

  const cookieState = cookies().get("instagram_oauth_state")?.value;
  if (state !== cookieState) {
    return NextResponse.redirect(
      new URL("/settings/connections?error=state_mismatch", request.url)
    );
  }

  try {
    const shortToken = await exchangeCodeForToken(code);
    const longToken = await exchangeForLongLivedToken(shortToken.access_token);
    const info = await fetchUserInfo(longToken.access_token);

    const enc = encryptToken(longToken.access_token);
    const expiresAt = new Date(Date.now() + longToken.expires_in * 1000);

    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("instagram_connections")
      .upsert(
        {
          user_id: user.id,
          instagram_business_id: info.user_id,
          facebook_page_id: null, // New API doesn't use FB Page
          username: info.username ?? null,
          access_token_ciphertext: enc.ciphertext,
          access_token_iv: enc.iv,
          access_token_tag: enc.tag,
          expires_at: expiresAt.toISOString(),
          scope: "instagram_business_basic,instagram_business_content_publish",
        },
        { onConflict: "user_id" }
      );

    if (dbError) {
      return NextResponse.redirect(
        new URL(
          `/settings/connections?error=${encodeURIComponent(dbError.message)}`,
          request.url
        )
      );
    }

    return NextResponse.redirect(
      new URL("/settings/connections?connected=instagram", request.url)
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      new URL(
        `/settings/connections?error=${encodeURIComponent(msg)}`,
        request.url
      )
    );
  }
}
