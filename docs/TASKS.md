# PostOne — 작업 보드

> `[ ]` 할 일 · `[~]` 진행 중 · `[x]` 완료. 상세 절차는 `manage-tasks` 스킬. Done은 최근 항목만 유지(이력은 git log).

## In Progress

- (없음)

## To Do

- [ ] 랜딩 후속 — 가격표(/pricing) 페이지, FAQ 섹션, 실제 제품 스크린샷 교체
- [ ] 예약 발행(스케줄링) — 발행 큐 + 시간 지정
- [ ] 결제 연동 — Toss Payments + 4단계 요금제
- [ ] 사용량 미터링 — 발행 수/AI 변환 카운트
- [ ] 온보딩 플로우
- [ ] 로그인 세션 유지 브라우저 검증 — 체크/미체크 케이스(빌드로 검증 불가)
- [ ] 테스트 발행물 정리

## Done (최근)

- [x] 랜딩 페이지 본격 구현 — 7섹션(히어로 카드뉴스 목업/기능/3스텝/본문→카드/CTA), 스크롤 리빌(useInView), 피드팡·Buffer 참고 · 2026-05-31
- [x] 아키텍처 3그룹 재편 — (marketing)/(app)/(auth), 앱홈 /dashboard, middleware 인증 가드, error/not-found/loading + 페이지 metadata, dead code(editor·character-counter) 삭제, 랜딩 골격 · 2026-05-30
- [x] 커스텀 디자인 시스템 — Badge/Alert/Separator/Skeleton/PageHeader/EmptyState/ChannelBadge(브랜드 SVG) + 홈/이력/연동/auth 적용, Linear·Vercel 패턴 · 2026-05-30
- [x] 로그인 상태 유지(remember me) — pm_remember 플래그 + server/middleware 정책, 보안 리뷰 반영 · 2026-05-30
- [x] Indigo 디자인 시스템 + 다크모드 — shadcn 토큰, next-themes, Pretendard, 화면 10개 토큰화 · 2026-05-30
- [x] 본문/인스타 카드 분리 에디터 · 2026-05-30
- [x] 인스타 카드 10장 API 한계 확인(코드 변경 불요)
- [x] CLAUDE.md + .claude/skills + task 체계 + Opus 4.8 가이드 반영 · 2026-05-30
