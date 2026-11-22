-- Reddit 연결 (OAuth2, duration=permanent)
-- access_token 은 24시간 만료 · refresh_token 은 무기한이므로 둘 다 암호화 저장하고
-- 만료 시 refresh_token 으로 조용히 갱신한다.
create table public.reddit_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reddit_user_id text,                            -- /api/v1/me 의 id
  reddit_username text not null,                  -- u/ 없이 저장 (예: "iosdev_kim")
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_tag text not null,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_tag text not null,
  expires_at timestamptz not null,
  scope text not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.reddit_connections enable row level security;

create policy "Users manage own reddit connection"
  on public.reddit_connections for all
  using (auth.uid() = user_id);

-- Reddit 발행 기록: LinkedIn/Threads 에 없는 서브레딧·제목·플레어·원문 링크 보존
alter table public.posts
  add column if not exists subreddit text,
  add column if not exists title text,
  add column if not exists flair_id text,
  add column if not exists permalink text;

-- 임시저장: Reddit 전용 입력(서브레딧/제목/링크/플레어) 보존
alter table public.drafts
  add column if not exists reddit jsonb;
