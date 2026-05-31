# PostOne — 작업 보드

> `[ ]` 할 일 · `[~]` 진행 중 · `[x]` 완료. 상세 절차는 `manage-tasks` 스킬. Done은 최근 항목만 유지(이력은 git log).

## In Progress

- (없음)

## To Do

### 다음 구현 (계획: `docs/plans/2026-05-31-draft-image-schedule.md` · 순차)
- [ ] ③ 예약 발행 (+토큰갱신 cron 묶음) — Supabase pg_cron + cron route, scheduled_at/status/재시도 · Phase 2 ← 다음

### 기타
- [ ] 보안 강화(리뷰 LOW) — upload.ts `server-only`+BUCKET 분리 · storage.objects RLS 정책 · 버킷 allowed_mime_types/file_size_limit · 업로드 경로 랜덤 suffix · refresh_token 만료 추적
- [ ] 테스트 발행물 삭제 — LinkedIn 실발행분(urn:li:share:7466…)
- [ ] 랜딩 후속 — 가격표(/pricing) 페이지, FAQ 섹션, 실제 제품 스크린샷 교체
- [ ] 결제 연동 — Toss Payments + 4단계 요금제
- [ ] 사용량 미터링 — 발행 수/AI 변환 카운트
- [ ] 온보딩 플로우
- [ ] 로그인 세션 유지 브라우저 검증 — 체크/미체크 케이스(빌드로 검증 불가)
- [ ] 테스트 발행물 정리

## Done (최근)

- [x] 발행 상세 페이지(/history/[id]) — 본문 + 채널별 결과 + 인스타 카드 이미지, 카드 클릭 진입. 인스타 기록 content=본문 · 2026-05-31
- [x] 발행이력 개편 — batch_id 본문별 묶음 + 채널 탭(전체/LinkedIn/Threads/IG), migration 0006 · 2026-05-31
- [x] 저장글 관리 페이지(/drafts) — 본문 미리보기/이어쓰기/삭제 + nav 링크 · 2026-05-31
- [x] 임시저장(drafts) — 서버 저장, 디바운스(2.5s) 자동저장 + 복원 배너 + 발행 시 삭제, migration 0005, RLS · 2026-05-31
- [x] 카드 설명 줄바꿈 — 이미 작동 확인(Textarea 입력 + trim 보존 + 템플릿 pre-wrap), 수정 불요 · 2026-05-31
- [x] 토큰 갱신 — 3채널 refresh(재연동 없이), refreshConnection + 갱신 버튼, migration 0004, 보안리뷰 LOW · 2026-05-31
- [x] 이미지 업로드 — 사용자 이미지 → IG 카드 배경(카드별), 템플릿 오버레이. **프로덕션 픽스: signed URL 직접 업로드**(Vercel/서버액션 body 제한 우회) · 2026-05-31
- [x] 본문=인스타 캡션 통합 + 캡션란 제거 + 본문 카운터 인스타 추가 · 2026-05-31
- [x] 랜딩 페이지 본격 구현 — 7섹션(히어로 카드뉴스 목업/기능/3스텝/본문→카드/CTA), 스크롤 리빌(useInView), 피드팡·Buffer 참고 · 2026-05-31
- [x] 아키텍처 3그룹 재편 — (marketing)/(app)/(auth), 앱홈 /dashboard, middleware 인증 가드, error/not-found/loading + 페이지 metadata, dead code(editor·character-counter) 삭제, 랜딩 골격 · 2026-05-30
- [x] 커스텀 디자인 시스템 — Badge/Alert/Separator/Skeleton/PageHeader/EmptyState/ChannelBadge(브랜드 SVG) + 홈/이력/연동/auth 적용, Linear·Vercel 패턴 · 2026-05-30
- [x] 로그인 상태 유지(remember me) — pm_remember 플래그 + server/middleware 정책, 보안 리뷰 반영 · 2026-05-30
- [x] Indigo 디자인 시스템 + 다크모드 — shadcn 토큰, next-themes, Pretendard, 화면 10개 토큰화 · 2026-05-30
- [x] 본문/인스타 카드 분리 에디터 · 2026-05-30
- [x] 인스타 카드 10장 API 한계 확인(코드 변경 불요)
- [x] CLAUDE.md + .claude/skills + task 체계 + Opus 4.8 가이드 반영 · 2026-05-30
