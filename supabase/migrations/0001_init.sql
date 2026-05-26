-- Profiles: 사용자 메타데이터
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 자동 프로필 생성 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- LinkedIn 연동: 암호화된 토큰
create table public.linkedin_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linkedin_sub text not null,
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_tag text not null,
  expires_at timestamptz not null,
  scope text not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.linkedin_connections enable row level security;

create policy "Users manage own linkedin connection"
  on public.linkedin_connections for all
  using (auth.uid() = user_id);

-- 발행 이력
create type public.publish_status as enum ('pending', 'success', 'failed');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  channel text not null,
  external_id text,
  status public.publish_status not null default 'pending',
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Users manage own posts"
  on public.posts for all
  using (auth.uid() = user_id);

create index posts_user_created_idx on public.posts (user_id, created_at desc);
