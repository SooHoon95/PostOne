-- Instagram 카드 데이터(카드별 제목/설명)를 발행 기록에 보존.
-- 카드 텍스트는 캡션(본문)과 무관하며 오직 이 컬럼에만 저장된다.
-- nullable: 기존 행/비-인스타 채널은 null로 남는다.
alter table public.posts add column if not exists instagram_cards jsonb;
