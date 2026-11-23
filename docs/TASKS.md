# PostOne — 작업 보드

> `[ ]` 할 일 · `[~]` 진행 중 · `[x]` 완료. 상세 절차는 `manage-tasks` 스킬. Done은 최근 항목만 유지(이력은 git log).

## In Progress

- (없음)

## To Do

### 다음 구현 (계획: `docs/plans/2026-05-31-draft-image-schedule.md` · 순차)
- [ ] 예약 발행 인프라 설정 — `0009_scheduled_posts.sql` 적용 + Supabase pg_cron/pg_net 등록 + Vercel `CRON_SECRET`·`SUPABASE_SERVICE_ROLE_KEY` 확인
- [ ] Reddit API 경로 재개 — Responsible Builder Policy 로 신규 OAuth 앱 생성 제한. 승인 가능해지면 기존 OAuth 코드(1단계)로 전환, 익스텐션 채우기는 폴백으로 유지

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

- [x] Reddit 익스텐션 채우기 — `content-reddit.js`(제목·본문 contenteditable·서브레딧 힌트), background `redditDraft` 저장·탭 열기(r/<sub>/submit)·채우기, popup Reddit 섹션, AI 패널 'Reddit 확장으로 전송'·OAuth 미연결 안내, manifest v1.1 · 2026-11-23
- [x] 예약 발행 — `scheduled_posts` 큐(migration 0009) + `claim_due_scheduled_posts` RPC(FOR UPDATE SKIP LOCKED·10분 stale 회수) + `/api/cron/publish`·`/api/cron/refresh-tokens`(CRON_SECRET) + `/compose` 즉시/예약 토글 + 발행 이력 예약 섹션·취소, attempts 재시도·batch_id 중복 방지 · 2026-11-23
- [x] 3단계 Peerlist — 크롬 익스텐션 MVP + AI 패널 전송 연동 + 브리지 검증 · 2026-11-22
- [x] 2단계 AI 채널별 변환 — 5채널 프롬프트·프로바이더(Claude/OpenAI)·/api/ai/adapt·패널에서 채널별 본문 발행 연동 · 2026-11-22
- [x] 1단계 Reddit — OAuth2(permanent)·토큰 자동 갱신, 서브레딧/제목/링크/플레어 발행·기록(migration 0008) · 2026-11-22
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
