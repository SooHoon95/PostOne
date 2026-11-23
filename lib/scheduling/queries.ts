import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel, ChannelResult, MultiPublishInput } from "@/lib/posts/types";

/** 예약 발행 상태 — DB check 제약과 동일하게 유지한다. */
export type ScheduledStatus =
  | "scheduled"
  | "processing"
  | "published"
  | "failed"
  | "canceled";

export type ScheduledPostRow = {
  id: string;
  user_id: string;
  scheduled_at: string;
  status: ScheduledStatus;
  attempts: number;
  max_attempts: number;
  payload: unknown;
  batch_id: string;
  results: ChannelResult[] | null;
  error_message: string | null;
  last_attempt_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
};

/** 화면 표시용으로 정리한 예약 항목 */
export type ScheduledPostView = {
  id: string;
  scheduledAt: string;
  status: ScheduledStatus;
  channels: Channel[];
  body: string;
  redditTitle: string | null;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  publishedAt: string | null;
  results: ChannelResult[];
};

const VALID_CHANNELS: Channel[] = [
  "linkedin",
  "threads",
  "instagram",
  "reddit",
];

export function asChannelList(value: unknown): Channel[] {
  if (!Array.isArray(value)) return [];
  const list: Channel[] = [];
  for (const item of value) {
    if (typeof item === "string" && (VALID_CHANNELS as string[]).includes(item)) {
      const channel = item as Channel;
      if (!list.includes(channel)) list.push(channel);
    }
  }
  return list;
}

/** DB jsonb payload → MultiPublishInput (형식이 깨졌으면 null) */
export function parseScheduledPayload(value: unknown): MultiPublishInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const channels = asChannelList(raw.channels);
  if (channels.length === 0) return null;

  const channelContents: Partial<Record<Channel, string>> = {};
  if (raw.channelContents && typeof raw.channelContents === "object") {
    const map = raw.channelContents as Record<string, unknown>;
    for (const channel of VALID_CHANNELS) {
      const entry = map[channel];
      if (typeof entry === "string" && entry.trim()) {
        channelContents[channel] = entry;
      }
    }
  }

  const redditRaw =
    raw.reddit && typeof raw.reddit === "object"
      ? (raw.reddit as Record<string, unknown>)
      : null;

  return {
    channels,
    body: typeof raw.body === "string" ? raw.body : "",
    instagramCards: Array.isArray(raw.instagramCards)
      ? (raw.instagramCards as MultiPublishInput["instagramCards"])
      : [],
    instagramTemplate:
      typeof raw.instagramTemplate === "string"
        ? (raw.instagramTemplate as MultiPublishInput["instagramTemplate"])
        : undefined,
    reddit: redditRaw
      ? {
          subreddit:
            typeof redditRaw.subreddit === "string" ? redditRaw.subreddit : "",
          title: typeof redditRaw.title === "string" ? redditRaw.title : "",
          link: typeof redditRaw.link === "string" ? redditRaw.link : undefined,
          flairId:
            typeof redditRaw.flairId === "string" ? redditRaw.flairId : undefined,
        }
      : undefined,
    channelContents:
      Object.keys(channelContents).length > 0 ? channelContents : undefined,
  };
}

export function toScheduledPostView(row: ScheduledPostRow): ScheduledPostView {
  const payload = parseScheduledPayload(row.payload);
  return {
    id: row.id,
    scheduledAt: row.scheduled_at,
    status: row.status,
    channels: payload?.channels ?? [],
    body: payload?.body ?? "",
    redditTitle: payload?.reddit?.title ?? null,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    errorMessage: row.error_message,
    publishedAt: row.published_at,
    results: Array.isArray(row.results) ? row.results : [],
  };
}

// ─── 예약 시각 검증 ─────────────────────────────────────────────────────────

/** 최소 리드타임 — 지금 막 지난 시각/오타를 걸러낸다. */
export const MIN_SCHEDULE_LEAD_MS = 20 * 1000;
/** 최대 예약 범위 — 실수로 1년 뒤를 넣는 경우 차단. */
export const MAX_SCHEDULE_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

export type ParsedSchedule =
  | { ok: true; iso: string }
  | { ok: false; error: string };

/** ISO 문자열(클라이언트에서 UTC로 변환해 전달)을 검증한다. */
export function parseScheduledAt(
  value: string,
  now: Date = new Date()
): ParsedSchedule {
  const raw = (value ?? "").trim();
  if (!raw) return { ok: false, error: "예약 시각을 선택하세요." };

  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) {
    return { ok: false, error: "예약 시각 형식이 올바르지 않습니다." };
  }
  if (time - now.getTime() < MIN_SCHEDULE_LEAD_MS) {
    return { ok: false, error: "예약 시각은 지금 이후로 선택하세요." };
  }
  if (time - now.getTime() > MAX_SCHEDULE_AHEAD_MS) {
    return { ok: false, error: "예약은 1년 이내 시각으로 선택하세요." };
  }
  return { ok: true, iso: new Date(time).toISOString() };
}

// ─── 조회/생성/취소 ─────────────────────────────────────────────────────────

const ROW_COLUMNS =
  "id, user_id, scheduled_at, status, attempts, max_attempts, payload, " +
  "batch_id, results, error_message, last_attempt_at, published_at, " +
  "created_at, updated_at";

export async function schedulePostForUser({
  supabase,
  userId,
  scheduledAt,
  input,
}: {
  supabase: SupabaseClient;
  userId: string;
  scheduledAt: string;
  input: MultiPublishInput;
}): Promise<{ ok: boolean; id?: string; scheduledAt?: string; error?: string }> {
  const { data, error } = await supabase
    .from("scheduled_posts")
    .insert({
      user_id: userId,
      scheduled_at: scheduledAt,
      status: "scheduled",
      payload: input,
    })
    .select("id, scheduled_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: "예약 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  return {
    ok: true,
    id: data.id as string,
    scheduledAt: (data.scheduled_at as string) ?? scheduledAt,
  };
}

export async function cancelScheduledPostForUser({
  supabase,
  userId,
  id,
}: {
  supabase: SupabaseClient;
  userId: string;
  id: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "예약 항목을 찾을 수 없습니다." };

  const { data, error } = await supabase
    .from("scheduled_posts")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .select("id");

  if (error) {
    return { ok: false, error: "예약 취소에 실패했습니다." };
  }
  if (!data || data.length === 0) {
    // 이미 발행 중이거나 처리된 예약 — 조용히 성공 처리하지 않는다.
    return {
      ok: false,
      error: "이미 처리가 시작된 예약입니다. 취소할 수 없습니다.",
    };
  }
  return { ok: true };
}

export async function listScheduledPosts({
  supabase,
  userId,
  statuses,
  limit = 10,
  order = "asc",
}: {
  supabase: SupabaseClient;
  userId: string;
  statuses: ScheduledStatus[];
  limit?: number;
  order?: "asc" | "desc";
}): Promise<ScheduledPostView[]> {
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select(ROW_COLUMNS)
    .eq("user_id", userId)
    .in("status", statuses)
    .order("scheduled_at", { ascending: order === "asc" })
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown as ScheduledPostRow[]).map(toScheduledPostView);
}

/** 예약 화면 상단 — 예정/처리 중인 예약 */
export function listUpcomingScheduledPosts(
  params: Omit<Parameters<typeof listScheduledPosts>[0], "statuses" | "order">
) {
  return listScheduledPosts({
    ...params,
    statuses: ["scheduled", "processing"],
    order: "asc",
  });
}

/** 예약 화면 상단 — 최근 실패/취소된 예약 */
export function listRecentScheduledHistory(
  params: Omit<Parameters<typeof listScheduledPosts>[0], "statuses" | "order">
) {
  return listScheduledPosts({
    ...params,
    statuses: ["failed", "canceled"],
    order: "desc",
  });
}
