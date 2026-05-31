-- LinkedIn refresh token 저장 (60일 access token을 재연동 없이 갱신).
-- Threads/Instagram은 long-lived 토큰 자체 refresh(th_refresh_token / ig_refresh_token)이므로 불필요.
-- nullable — refresh_token 없이 발급된 기존 행과 호환.
alter table public.linkedin_connections
  add column if not exists refresh_token_ciphertext text,
  add column if not exists refresh_token_iv text,
  add column if not exists refresh_token_tag text;
