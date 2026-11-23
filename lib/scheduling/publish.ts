import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureFreshConnections } from "@/lib/connections/token-core";
import { publishMultiForUser } from "@/lib/posts/publish-core";
import { validateMultiPublishInput } from "@/lib/posts/validate";
import type { Channel, ChannelResult } from "@/lib/posts/types";
import {
  parseScheduledPayload,
  type ScheduledPostRow,
} from "./queries";

/**
 * 예약 1건 실행 — 이미 claim(processing)된 행을 받아 실제 발행하고 결과를 기록한다.
 *
 * 견고성 규칙:
 * - 같은 batch_id 로 이미 성공한 채널은 건너뛴다(재시도 중복 발행 방지).
 * - 전 채널 실패 + 시도 여유 있음 → status 'scheduled' 로 되돌려 다음 주기에 재시도.
 * - 일부라도 성공 → 재시도하지 않고 'failed' 로 마감(성공 채널 중복 방지).
 * - 연결 없음/검증 실패는 재시도해도 결과가 같으므로 즉시 'failed'.
 */

export type ScheduledOutcome = "published" | "failed" | "retry";

export type ScheduledRunResult = {
  status: ScheduledOutcome;
  results: ChannelResult[];
  error?: string;
  /** 결과 저장(DB update) 실패 여부 — 다음 주기에 재처리된다. */
  saveFailed?: boolean;
};

const LABEL: Record<Channel, string> = {
  linkedin: "LinkedIn",
  threads: "Threads",
  instagram: "Instagram",
  reddit: "Reddit",
};

function orderResults(
  results: ChannelResult[],
  channels: Channel[]
): ChannelResult[] {
  return [...results].sort(
    (a, b) => channels.indexOf(a.channel) - channels.indexOf(b.channel)
  );
}

function failureSummary(
  failures: ChannelResult[],
  partial: boolean
): string {
  const detail = failures
    .map((f) => `${LABEL[f.channel] ?? f.channel}: ${f.error ?? "발행 실패"}`)
    .join(" / ");
  return partial ? `일부 채널 발행 실패 — ${detail}` : detail;
}

export async function publishScheduledPost({
  supabase,
  row,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  row: ScheduledPostRow;
  now?: Date;
}): Promise<ScheduledRunResult> {
  const payload = parseScheduledPayload(row.payload);
  if (!payload) {
    return finalize({
      supabase,
      row,
      outcome: "failed",
      results: [],
      error: "예약 내용을 읽을 수 없습니다. 다시 예약해 주세요.",
    });
  }

  const invalid = validateMultiPublishInput(payload);
  if (invalid) {
    return finalize({
      supabase,
      row,
      outcome: "failed",
      results: [],
      error: invalid,
    });
  }

  const channels = payload.channels;

  // 발행 직전 토큰 점검 (만료 임박분만 갱신). 실패해도 발행은 시도한다.
  await ensureFreshConnections({
    supabase,
    userId: row.user_id,
    channels,
    now,
  });

  // 같은 batch_id 로 이미 성공한 채널 — 이전 시도에서 발행된 것.
  const { data: priorRows } = await supabase
    .from("posts")
    .select("channel, status")
    .eq("user_id", row.user_id)
    .eq("batch_id", row.batch_id);

  const succeeded = new Set<Channel>(
    ((priorRows ?? []) as { channel: string; status: string }[])
      .filter((p) => p.status === "success")
      .map((p) => p.channel as Channel)
  );

  const remaining = channels.filter((c) => !succeeded.has(c));
  let results: ChannelResult[] = Array.from(succeeded).map((channel) => ({
    channel,
    success: true,
  }));

  if (remaining.length > 0) {
    const run = await publishMultiForUser({
      supabase,
      userId: row.user_id,
      input: { ...payload, channels: remaining },
      batchId: row.batch_id,
    });
    results = [...results, ...run.results];
  }

  results = orderResults(results, channels);

  const failures = results.filter((r) => !r.success);
  const partial = failures.length > 0 && failures.length < channels.length;

  if (failures.length === 0) {
    return finalize({
      supabase,
      row,
      outcome: "published",
      results,
      publishedAt: now.toISOString(),
    });
  }

  if (partial) {
    return finalize({
      supabase,
      row,
      outcome: "failed",
      results,
      error: failureSummary(failures, true),
    });
  }

  if (row.attempts < row.max_attempts) {
    return finalize({
      supabase,
      row,
      outcome: "retry",
      results,
      error: failureSummary(failures, false),
    });
  }

  return finalize({
    supabase,
    row,
    outcome: "failed",
    results,
    error: failureSummary(failures, false),
  });
}

async function finalize({
  supabase,
  row,
  outcome,
  results,
  error,
  publishedAt,
}: {
  supabase: SupabaseClient;
  row: ScheduledPostRow;
  outcome: ScheduledOutcome;
  results: ChannelResult[];
  error?: string;
  publishedAt?: string;
}): Promise<ScheduledRunResult> {
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status:
      outcome === "published"
        ? "published"
        : outcome === "retry"
        ? "scheduled"
        : "failed",
    results,
    error_message: error ?? null,
    updated_at: nowIso,
  };
  if (outcome === "published") {
    patch.published_at = publishedAt ?? nowIso;
  }

  // claim 이후 상태가 그대로 processing 인 행만 갱신한다.
  const { error: dbError } = await supabase
    .from("scheduled_posts")
    .update(patch)
    .eq("id", row.id)
    .eq("status", "processing");

  return {
    status: outcome,
    results,
    error,
    saveFailed: !!dbError,
  };
}
