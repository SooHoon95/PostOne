-- 예약 발행 — 정해진 시각에 자동 발행 (Phase 2)
--
-- posts 는 "발행 결과 기록" 테이블이므로 예약 상태를 섞지 않고, 발행 대기 큐를
-- 별도 테이블로 둔다. 예약 내용 전체(payload = MultiPublishInput)를 저장해 두고
-- cron(/api/cron/publish)이 due 행을 claim 해 posts 로 발행한다.
--
-- batch_id 는 예약 등록 시점에 만들어 두고, 발행되는 posts 행들이 이 값을 공유한다.
-- 재시도 시 같은 batch_id 의 "성공" 채널은 건너뛰어 중복 발행을 막는다.

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'processing', 'published', 'failed', 'canceled')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  payload jsonb not null,
  batch_id uuid not null default gen_random_uuid(),
  results jsonb,
  error_message text,
  last_attempt_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.scheduled_posts is
  '예약 발행 큐 — payload(MultiPublishInput)를 scheduled_at 시각에 발행';
comment on column public.scheduled_posts.batch_id is
  '발행 시 posts.batch_id 로 그대로 사용 (재시도 중복 방지 기준)';

-- 사용자별 목록 조회 / due 픽업 / batch_id 중복 방지
create index if not exists scheduled_posts_user_idx
  on public.scheduled_posts (user_id, scheduled_at desc);

create index if not exists scheduled_posts_due_idx
  on public.scheduled_posts (scheduled_at)
  where status = 'scheduled';

create unique index if not exists scheduled_posts_batch_idx
  on public.scheduled_posts (batch_id);

alter table public.scheduled_posts enable row level security;

-- 본인 예약만 조회
create policy "Users read own scheduled posts"
  on public.scheduled_posts for select
  using (auth.uid() = user_id);

-- 본인 예약만 등록 (status/batch_id 는 DB 기본값 사용)
create policy "Users create own scheduled posts"
  on public.scheduled_posts for insert
  with check (auth.uid() = user_id);

-- 예약 취소만 허용 — scheduled 상태에서 canceled 로 바꾸는 경우에 한한다.
-- (processing 이후 상태 변경은 service role(cron)만 가능)
create policy "Users cancel own scheduled posts"
  on public.scheduled_posts for update
  using (auth.uid() = user_id and status = 'scheduled')
  with check (auth.uid() = user_id and status = 'canceled');

grant select, insert, update on public.scheduled_posts to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- due 예약 원자적 claim
--   · processing 이 10분 넘게 멈춘 행은 회수(시도 여유 있으면 재시도, 아니면 실패)
--   · scheduled_at <= now() 인 행을 FOR UPDATE SKIP LOCKED 로 선점해 중복 발행 방지
--   · security definer + service_role 전용 실행
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.claim_due_scheduled_posts(p_limit int default 10)
returns setof public.scheduled_posts
language sql
security definer
set search_path = public
as $$
  with stale as (
    update public.scheduled_posts
       set status = case when attempts >= max_attempts then 'failed' else 'scheduled' end,
           error_message = case
             when attempts >= max_attempts then coalesce(error_message, '처리 시간 초과')
             else error_message
           end,
           updated_at = now()
     where status = 'processing'
       and coalesce(last_attempt_at, updated_at) < now() - interval '10 minutes'
    returning 1
  ), due as (
    select id
      from public.scheduled_posts
     where status = 'scheduled'
       and scheduled_at <= now()
     order by scheduled_at
     limit greatest(p_limit, 0)
     for update skip locked
  )
  update public.scheduled_posts s
     set status = 'processing',
         attempts = s.attempts + 1,
         last_attempt_at = now(),
         updated_at = now()
    from due
   where s.id = due.id
  returning s.*;
$$;

revoke all on function public.claim_due_scheduled_posts(int) from public;
revoke all on function public.claim_due_scheduled_posts(int) from anon, authenticated;
grant execute on function public.claim_due_scheduled_posts(int) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- [선택] cron 등록 — 배포 후 Supabase SQL Editor 에서 1회 실행.
--   pg_cron · pg_net 확장은 Dashboard > Database > Extensions 에서 먼저 켠다.
--   <배포 도메인> 과 <CRON_SECRET>(Vercel 환경변수와 같은 값)을 채워 실행.
--
-- select cron.schedule('postone-publish', '* * * * *', $cron$
--   select net.http_post(
--     url := 'https://<배포 도메인>/api/cron/publish',
--     headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
--     timeout_milliseconds := 30000
--   );
-- $cron$);
--
-- select cron.schedule('postone-refresh-tokens', '0 4 * * *', $cron$
--   select net.http_post(
--     url := 'https://<배포 도메인>/api/cron/refresh-tokens',
--     headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
--     timeout_milliseconds := 30000
--   );
-- $cron$);
-- ─────────────────────────────────────────────────────────────────────────────
