-- Threads 연결 (long-lived token, 60일 만료)
create table public.threads_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  threads_user_id text not null,                  -- Meta가 부여하는 사용자 ID
  username text,                                  -- @handle (선택)
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_tag text not null,
  expires_at timestamptz not null,
  scope text not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.threads_connections enable row level security;

create policy "Users manage own threads connection"
  on public.threads_connections for all
  using (auth.uid() = user_id);

-- Instagram 연결 (Facebook Graph API 경유, Business 계정 + FB Page 필요)
create table public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_business_id text not null,            -- IG Business Account ID
  facebook_page_id text not null,                 -- 연결된 FB Page ID
  username text,                                  -- @handle
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_tag text not null,
  expires_at timestamptz not null,
  scope text not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.instagram_connections enable row level security;

create policy "Users manage own instagram connection"
  on public.instagram_connections for all
  using (auth.uid() = user_id);

-- posts 테이블: instagram 카드 이미지 URL 저장용 컬럼
alter table public.posts
  add column if not exists media_urls text[] default null;

-- posts 채널 인덱스
create index if not exists posts_channel_idx on public.posts (channel);
