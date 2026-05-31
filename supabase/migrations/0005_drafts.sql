-- 글쓰기 임시저장: 사용자당 1개 (user_id PK, upsert).
-- 세션 끊겨도 작성 중인 글 서버 복원 (다기기 동기화).
create table public.drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  body text default '',
  instagram_cards jsonb default '[]',
  instagram_template text,
  selected_channels jsonb default '[]',
  updated_at timestamptz default now()
);

alter table public.drafts enable row level security;

create policy "Users manage own draft"
  on public.drafts for all
  using (auth.uid() = user_id);
