-- 멀티 발행 묶음: 한 번의 publishMulti 호출에서 생성된 채널별 posts row를
-- 동일 batch_id로 묶어 본문 단위 이력 그룹핑을 가능하게 한다.
-- nullable: 기존 행/단건 직접 발행은 null로 남아 개별 카드로 표시.
alter table public.posts add column if not exists batch_id uuid;

create index if not exists posts_batch_id_idx on public.posts (batch_id);
