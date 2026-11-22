import type {
  RedditApiError,
  RedditFlair,
  RedditSubmitResponse,
} from "./types";
import { REDDIT_USER_AGENT } from "./oauth";
import { isValidSubreddit, normalizeSubreddit } from "./subreddit";

export { isValidSubreddit, normalizeSubreddit };

const API_BASE = "https://oauth.reddit.com";

export const REDDIT_TITLE_MAX = 300;
export const REDDIT_SELF_TEXT_MAX = 40000;

export type SubmitParams = {
  accessToken: string;
  subreddit: string;
  title: string;
  /** self 글 본문 (link 글에서는 무시) */
  body?: string;
  /** 값이 있으면 링크(link) 글, 없으면 텍스트(self) 글 */
  url?: string;
  flairId?: string;
};

export type SubmitResult = {
  id: string;
  fullname: string; // t3_xxx
  url: string | null;
  permalink: string | null; // 절대 URL
};

function formatApiErrors(errors: RedditApiError[]): string {
  return errors
    .map((e) => {
      if (!Array.isArray(e)) return String(e);
      const [code, message] = e;
      return message ? `${code}: ${message}` : String(code);
    })
    .join("; ");
}

export async function submitPost({
  accessToken,
  subreddit,
  title,
  body = "",
  url,
  flairId,
}: SubmitParams): Promise<SubmitResult> {
  const sr = normalizeSubreddit(subreddit);
  const trimmedTitle = title.trim();
  const link = url?.trim() ?? "";
  const text = body.trim();

  if (!sr) throw new Error("Reddit: subreddit is required");
  if (!isValidSubreddit(sr)) throw new Error("Reddit: invalid subreddit name");
  if (!trimmedTitle) throw new Error("Reddit: title is required");
  if (trimmedTitle.length > REDDIT_TITLE_MAX) {
    throw new Error(`Reddit: title exceeds ${REDDIT_TITLE_MAX} chars`);
  }
  if (link && !/^https?:\/\//i.test(link)) {
    throw new Error("Reddit: link must start with http(s)://");
  }
  if (!link && !text) throw new Error("Reddit: text or link is required");
  if (!link && text.length > REDDIT_SELF_TEXT_MAX) {
    throw new Error(`Reddit: text exceeds ${REDDIT_SELF_TEXT_MAX} chars`);
  }

  const form = new URLSearchParams();
  form.set("api_type", "json");
  form.set("kind", link ? "link" : "self");
  form.set("sr", sr);
  form.set("title", trimmedTitle);
  if (link) form.set("url", link);
  else form.set("text", text);
  if (flairId) form.set("flair_id", flairId);

  const res = await fetch(`${API_BASE}/api/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": REDDIT_USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Reddit submit failed: ${res.status} ${t}`);
  }

  // Reddit 은 거부 사유도 HTTP 200 + json.errors 로 돌려준다.
  const data = (await res.json()) as RedditSubmitResponse;
  const errors = data.json?.errors ?? [];
  if (errors.length > 0) {
    throw new Error(`Reddit submit failed: ${formatApiErrors(errors)}`);
  }

  const result = data.json?.data;
  if (!result?.id) throw new Error("Reddit submit failed: empty response");

  return {
    id: result.id,
    fullname: result.name ?? `t3_${result.id}`,
    url: result.url ?? null,
    permalink: result.permalink
      ? `https://www.reddit.com${result.permalink}`
      : null,
  };
}

/** 서브레딧에서 선택 가능한 플레어 목록. 플레어가 없으면 빈 배열. */
export async function getSubredditFlairs({
  accessToken,
  subreddit,
}: {
  accessToken: string;
  subreddit: string;
}): Promise<RedditFlair[]> {
  const sr = normalizeSubreddit(subreddit);
  if (!isValidSubreddit(sr)) throw new Error("Reddit: invalid subreddit name");

  const res = await fetch(
    `${API_BASE}/r/${encodeURIComponent(sr)}/api/link_flair_v2`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": REDDIT_USER_AGENT,
      },
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Reddit flair fetch failed: ${res.status} ${t}`);
  }

  const data = (await res.json()) as RedditFlair[] | null;
  if (!Array.isArray(data)) return [];
  return data
    .filter((f) => !!f?.id)
    .map((f) => ({
      id: f.id,
      text: f.text || f.id,
      text_editable: !!f.text_editable,
    }));
}
