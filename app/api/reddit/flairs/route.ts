import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import {
  getSubredditFlairs,
  isValidSubreddit,
  normalizeSubreddit,
} from "@/lib/reddit/client";
import {
  REDDIT_CONNECTION_COLUMNS,
  resolveRedditToken,
  type RedditConnectionRow,
} from "@/lib/reddit/session";

/**
 * 글쓰기 화면 플레어 선택용: 서브레딧의 link flair 목록.
 * 플레어가 없거나 조회에 실패해도 글 발행은 가능하므로 빈 목록으로 응답한다.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  const subreddit = new URL(request.url).searchParams.get("subreddit") ?? "";

  if (!isValidSubreddit(subreddit)) {
    return NextResponse.json({ flairs: [], error: "invalid_subreddit" }, { status: 400 });
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("reddit_connections")
    .select(REDDIT_CONNECTION_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json(
      { flairs: [], error: "not_connected" },
      { status: 400 }
    );
  }

  try {
    const { accessToken } = await resolveRedditToken({
      supabase,
      userId: user.id,
      connection: data as unknown as RedditConnectionRow,
    });
    const flairs = await getSubredditFlairs({
      accessToken,
      subreddit: normalizeSubreddit(subreddit),
    });
    return NextResponse.json({ flairs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ flairs: [], error: msg }, { status: 502 });
  }
}
