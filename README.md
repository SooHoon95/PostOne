# OnePost

한국 직장인 지식 크리에이터를 위한 멀티 채널 콘텐츠 발행 SaaS.

> Codename `OnePost` — 정식 브랜드명 미정.

## Setup

1. `cp .env.local.example .env.local` 후 값 채우기
2. `pnpm install`
3. `pnpm dev`

## Test

- 단위/통합: `pnpm test`
- E2E: `pnpm e2e`

## Tech Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (PostgreSQL + Auth)
- Vitest + Playwright

## Channels (Plan 1)

- ✅ LinkedIn (공식 API)

추가 채널(Threads, Instagram, Tistory) 및 한국어 톤 변환, 인스타 카드, 예약 발행, 결제는 후속 Plan에서 추가됩니다.
