# PostOne — PRD

> 제품 요구사항·로드맵의 단일 출처(레포 로컬). 상세 사업/기술 문서는 Notion(paranote - PostOne) 참조.

## 1. 비전 / 타깃

- **비전**: 한 번 써서 LinkedIn·Threads·Instagram에 동시 발행. 채널별 재작성 부담 제거.
- **타깃**: 퍼스널 브랜딩하는 한국 직장인·1인 사업가·크리에이터.
- **차별점**: 본문/카드 분리 에디터 + **인스타 카드뉴스 자동 생성(Satori)**. (한국어 톤 변환은 경쟁사 피드팡이 이미 무료 제공 — 카드뉴스 특화로 차별화.)

## 2. MVP 범위 (구현됨)

- 멀티채널 에디터(본문 = LinkedIn/Threads, 카드 = Instagram 분리)
- 3채널 OAuth 연동(LinkedIn v202509 / Threads / Instagram Business Login)
- 인스타 캐러셀 카드뉴스 생성(Satori→SVG→PNG, Pretendard) · 카드 2~10장(API 한계)
- 멀티 발행, 발행 이력
- 이메일 로그인/회원가입, **로그인 상태 유지(remember me)**
- Indigo 디자인 테마(라이트/다크)

## 3. 기능 로드맵

### Now (진행/직전 완료)
- ✅ Indigo 디자인 시스템 + 다크모드
- ✅ 로그인 세션 유지

### Next
- 랜딩 페이지(히어로/가격/CTA)
- 예약 발행(스케줄링)
- 결제 연동(Toss Payments) + 4단계 요금제(Free/Starter/Pro/Business)
- 사용량 미터링(발행 수/AI 변환 횟수)
- 온보딩 플로우

### Later
- 한국어 톤 변환(LLM) — 피드팡 대비 우위 확보 시
- 네이버 블로그 · Tistory 등 한국 토종 채널
- 팀 시트(다인 협업)
- Oracle Cloud 이전(인프라 비용)

## 4. 비기능 요구

- **보안**: 토큰 AES-256-GCM 암호화 저장. 시크릿은 Vercel 환경변수만. `.env.local` 커밋 금지.
- **성능**: 카드 생성/발행 서버 액션 `maxDuration` 고려. 인스타 컨테이너 status FINISHED 폴링.
- **품질**: 인증/결제/채널 변경은 `review-code` 2단계 리뷰 필수.

## 5. 백로그

- 경쟁사 대응: 피드팡(무료, 톤변환·예약 보유), 스마트포스트(한국 토종 채널) → 카드뉴스 특화 포지셔닝 강화.
- 발행 결과 분석/대시보드.
- 테스트 발행물 정리.
