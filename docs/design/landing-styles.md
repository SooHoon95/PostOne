# 랜딩 스타일 레지스트리

랜딩 페이지 디자인 변형을 기록·비교하는 단일 출처. 새 변형은 `/preview/<이름>`에 만들고 여기에 한 항목씩 추가한다. 채택본은 `/`(`app/(marketing)/page.tsx`).

공통 원칙(모든 변형 공유):
- 디자인 토큰만(`bg-card`/`text-foreground`/`primary`/`brand`/`channel-*`). 예외: 인스타 브랜드 그라데이션, brand CTA 그라데이션.
- 라이트/다크 양립. Pretendard 본문.
- **카피는 명사형(체언) 종결** (CTA 버튼 라벨만 동사 허용).
- 스크롤 리빌: `useInView`(IntersectionObserver) + `<Reveal>` fade-up. 신규 의존성 금지.
- 재사용 컴포넌트: `components/marketing/{reveal,card-news-mockup,body-to-cards}`, `components/channel-badge`, `components/ui/{button,card,badge}`.

---

## Style A — Editorial Indigo (채택본, `/`)

- **포지셔닝**: 소프트 모던(Notion/Stripe 계열). 에디토리얼 무드.
- **레이아웃**: 7섹션 — 히어로(분할: 카피+CTA / 카드뉴스 덱) → 채널 띠 → 기능 3 → 작동 3스텝 → 본문→카드 → 무료 CTA → brand 그라데이션 배너.
- **히어로 비주얼**: 부채꼴로 쌓인 인스타 카드뉴스 덱(`CardNewsMockup`), 뒤에 brand blur.
- **컬러**: 중립 캔버스 + Indigo→Violet brand를 포인트로. brand `/10`~`/15` 틴트.
- **타이포**: 그라데이션 헤드라인, 넉넉한 여백, 섹션 `space-y-8`.
- **모션**: 섹션 진입 fade-up + 카드 스태거(0/90/180ms).
- **파일**: `app/(marketing)/page.tsx`, `components/marketing/*`.
- **커밋**: `5fe6152`.

---

## Style B — Classic Split SaaS (`/preview/classic`)

- **포지셔닝**: 좌우분할 클래식(Stripe/피드팡 계열). 전환율 검증된 정석.
- **레이아웃**: 히어로 좌(카피+CTA)/우(카드뉴스 목업) 균형 분할 + 기능 그리드.
- **차이점(vs A)**: A는 에디토리얼 흐름, B는 좌우 균형·제품 즉시 노출.
- **파일**: `app/(marketing)/preview/classic/page.tsx`.
- **상태**: 비교용 변형(실험 중).
