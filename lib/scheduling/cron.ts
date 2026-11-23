import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listExpiringConnections,
  refreshConnectionForUser,
} from "@/lib/connections/token-core";
import type { ScheduledPostRow } from "./queries";
import { publishScheduledPost } from "./publish";

/** cron 엔드포인트 인증 — Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret. */
export function isAuthorizedCron(
  request: Request,
  secret: string | undefined = process.env.CRON_SECRET
): boolean {
  const expected = (secret ?? "").trim();
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const alt = (request.headers.get("x-cron-secret") ?? "").trim();

  return safeEqual(bearer, expected) || safeEqual(alt, expected);
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

// ─── 예약 발행 cron ─────────────────────────────────────────────────────────

export type PublishCronSummary = {
  claimed: number;
  published: number;
  failed: number;
  retrying: number;
  /** 결과 저장 실패(processing 으로 남음 → 10분 뒤 회수 대상) */
  saveFailed: number;
  errors: string[];
};

/**
 * due 예약을 원자적으로 claim 해 발행한다.
 * claim_due_scheduled_posts 는 FOR UPDATE SKIP LOCKED 로 중복 픽업을 막고,
 * 10분 넘게 processing 인 행은 재시도/실패로 회수한다.
 */
export async function runPublishCron({
  supabase,
  limit = 10,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  limit?: number;
  now?: Date;
}): Promise<PublishCronSummary> {
  const summary: PublishCronSummary = {
    claimed: 0,
    published: 0,
    failed: 0,
    retrying: 0,
    saveFailed: 0,
    errors: [],
  };

  const { data, error } = await supabase.rpc("claim_due_scheduled_posts", {
    p_limit: limit,
  });

  if (error) {
    summary.errors.push(`예약 픽업 실패: ${error.message}`);
    return summary;
  }

  const rows = (data ?? []) as ScheduledPostRow[];
  summary.claimed = rows.length;

  for (const row of rows) {
    try {
      const result = await publishScheduledPost({ supabase, row, now });
      if (result.saveFailed) summary.saveFailed += 1;
      if (result.status === "published") summary.published += 1;
      else if (result.status === "retry") summary.retrying += 1;
      else summary.failed += 1;
      if (result.status !== "published" && result.error) {
        summary.errors.push(`${row.id}: ${result.error}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      summary.errors.push(`${row.id}: ${msg}`);
    }
  }

  return summary;
}

// ─── 토큰 갱신 cron ─────────────────────────────────────────────────────────

export type TokenRefreshCronSummary = {
  scanned: number;
  refreshed: number;
  failed: number;
  errors: string[];
};

/**
 * 만료가 임박한(기본 24시간 이내) 연결 토큰을 미리 갱신한다.
 * LinkedIn/Reddit 은 refresh_token, Threads/Instagram 은 long-lived 갱신.
 */
export async function runTokenRefreshCron({
  supabase,
  horizonMs = 24 * 60 * 60 * 1000,
  now = new Date(),
  limitPerChannel = 50,
}: {
  supabase: SupabaseClient;
  horizonMs?: number;
  now?: Date;
  limitPerChannel?: number;
}): Promise<TokenRefreshCronSummary> {
  const summary: TokenRefreshCronSummary = {
    scanned: 0,
    refreshed: 0,
    failed: 0,
    errors: [],
  };

  const before = new Date(now.getTime() + horizonMs).toISOString();
  const targets = await listExpiringConnections({
    supabase,
    before,
    limitPerChannel,
  });
  summary.scanned = targets.length;

  for (const target of targets) {
    const result = await refreshConnectionForUser({
      supabase,
      userId: target.user_id,
      channel: target.channel,
    });
    if (result.ok) summary.refreshed += 1;
    else {
      summary.failed += 1;
      summary.errors.push(
        `${target.channel}/${target.user_id}: ${result.error ?? "갱신 실패"}`
      );
    }
  }

  return summary;
}
