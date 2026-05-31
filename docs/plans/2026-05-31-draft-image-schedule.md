# 구현 계획 — 임시저장 · 이미지업로드 · 예약발행

작성 2026-05-31 · 진행: **순차**(완성도 우선) · 각 기능 빌드+테스트+(보안영역)리뷰 후 커밋.

## 진행 순서 & 근거
**① 이미지업로드 → ② 임시저장 → ③ 예약발행** (단순 → 복잡).
세 기능 모두 `multi-channel-editor`를 수정하므로 **순차로 통합**해 파일 충돌을 피한다. 각 기능 내부에서는 DB·서버·UI를 병렬로 작업 가능.

## 검증 프로토콜 (공통)
- ⚠️ **dev 켜둔 채 `pnpm build` 금지** — `.next` 충돌. dev 끄고 build하거나 `tsc --noEmit` + `pnpm test`.
- 각 기능 완료 시: 빌드 + 테스트 + 인증/결제/채널 변경이면 `review-code` 2단계.
- pnpm 전용 · 토큰만(하드코딩 색 금지) · UI 카피 명사형 종결.

---

## 1️⃣ 이미지업로드 (난이도 ★ · Phase 2)
사용자 이미지를 인스타 카드 배경으로.
- **DB**: 없음 (Supabase Storage만)
- **파일**: `lib/cards/upload.ts`(재사용) · `lib/cards/templates.tsx`(배경 레이어) · 에디터 카드 섹션(업로드 input)
- **단계**: ① 이미지 업로드 액션(Storage) → ② 템플릿 배경 이미지 지원 → ③ 카드별 이미지 선택 UI → ④ Satori 카드에 배경 합성
- **검증**: 업로드 → 카드 생성 배경 반영 · 파일 타입/용량 제한

## 2️⃣ 임시저장 (난이도 ★★ · Phase 1)
세션 끊겨도 작성 중인 글 복원 (서버/다기기).
- **DB**: `migration 0004_drafts.sql` — `drafts(user_id PK, body, instagram_cards jsonb, instagram_template, selected_channels jsonb, updated_at)` + RLS(본인만)
- **파일**: `lib/drafts/actions.ts`(saveDraft/loadDraft/deleteDraft) · 에디터(자동저장+복원)
- **단계**: ① migration → ② 서버액션 3종 → ③ 디바운스(2~3초) 자동저장 + "저장됨" 표시 → ④ 진입 시 복원 배너(이어쓰기/새로 시작) → ⑤ 발행 성공 시 deleteDraft
- **검증**: 작성→이탈→재방문 복원 · 발행 후 삭제 · RLS 타인 접근 차단
- 스토리지: 텍스트만 → 1만 사용자 ~100MB(무료 한도 500MB 내), user_id PK upsert로 누적 0

## 3️⃣ 예약발행 (난이도 ★★★ · Phase 2)
정해진 시각 자동 발행, 실서비스 견고성.
- **DB**: `migration 0005` — posts에 `scheduled_at timestamptz`·`status`(scheduled/processing/published/failed)·`attempts int`
- **인프라**: Supabase **pg_cron**(1분) + **pg_net** → `/api/cron/publish-scheduled` (`CRON_SECRET` 헤더 보호)
- **파일**: cron route · `publishMulti` 재사용 · 에디터(즉시/예약 토글 + 시각 입력)
- **단계**: ① DB 스키마 → ② cron route(due 픽업 `FOR UPDATE SKIP LOCKED` + 발행 + 재시도) → ③ pg_cron 설정 → ④ 예약 UI → ⑤ 멱등성·토큰만료·타임존(UTC저장/KST표시)
- **견고성**: 중복발행 방지(atomic status 전환) · attempts 재시도 · 토큰 만료 시 failed+알림
- **검증**: 예약→시각 도래 발행 · 중복 방지 · 실패 재시도 · 인증 가드

---

## Phase 매핑
- Phase 1(상용화): **임시저장** (리텐션)
- Phase 2(차별화): 이미지업로드 · 예약발행
- 진행은 난이도순(이미지→임시저장→예약)이라 Phase와 순서는 무관.
