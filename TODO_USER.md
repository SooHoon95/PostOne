# TODO — 사용자가 직접 처리할 항목

이 파일은 자동화로 끝낼 수 없는 수동 단계를 정리한 것입니다. 깨어나면 위에서부터 차례로 처리하세요.

## ✅ 자동 완료된 것

- Next.js 14 + Tailwind + shadcn-style UI + Vitest 스캐폴드
- Supabase 클라이언트(서버/브라우저) + 마이그레이션 SQL (`supabase/migrations/0001_init.sql`)
- 인증 (Sign Up / Sign In / 미들웨어 / 보호 라우트 / 대시보드 셸)
- AES-256-GCM 토큰 암호화 유틸 + `TOKEN_ENCRYPTION_KEY` 자동 생성 → `.env.local`에 주입됨
- LinkedIn OAuth 흐름 (start route, callback route, 연동 페이지) — 코드 완성, 미동작 검증
- LinkedIn 발행 API 클라이언트 (`POST /rest/posts`) — 단위 테스트 통과
- 글쓰기 에디터 + 발행 Server Action + 발행 이력 화면
- Playwright 스모크 E2E 설정 + 시드 유저 자동 생성 (`scripts/seed-e2e-user.mjs` 실행 완료)
- 전체 단위 테스트: **18개 모두 통과** ✅
- TypeScript 타입체크 통과 ✅
- 9개 커밋으로 정리

## 🛑 사용자 수동 처리 항목

### 1. Supabase 마이그레이션 SQL 실행 확인 (이미 했다면 skip)

이미 실행했다고 알려주셨지만 다음 3개 테이블이 Supabase 콘솔 > Table Editor에 있는지 재확인:
- `profiles`
- `linkedin_connections`
- `posts`

없으면 `supabase/migrations/0001_init.sql` 을 SQL Editor에서 실행.

### 2. Supabase 이메일 확인 비활성화 (선택, 개발 편의)

기본적으로 가입 시 이메일 확인 링크가 발송됩니다. 개발 중에는 끄는 게 편함:

1. Supabase 콘솔 → **Authentication → Sign In / Up** (또는 Providers)
2. **Email** 섹션 → **Confirm email** OFF
3. 또는 그냥 본인 메일함 확인하고 링크 클릭

### 3. dev 서버 띄우고 가입 / LinkedIn 연동 흐름 확인

```bash
cd ~/Desktop/Code/onepost
pnpm dev
```

브라우저에서:
1. http://localhost:3000 → /login 으로 자동 리다이렉트되어야 함 ✅
2. `/signup` 으로 본인 이메일로 가입
3. (위 2번을 안 했다면) 메일 확인 클릭
4. 로그인 후 대시보드 화면 표시 확인
5. `/settings/connections` → "연결하기" 클릭 → LinkedIn 로그인 + 권한 동의 → 자동으로 `?connected=1`로 돌아오는지 확인
6. Supabase 콘솔 → `linkedin_connections` 테이블에 row 1개 (토큰은 hex 암호문) 확인

### 4. 실제 LinkedIn 글 발행 테스트

5번 연동 완료 후:
1. `/compose` 접속
2. 짧은 테스트 글 작성 (예: `OnePost 첫 발행 테스트 - 시각 ${new Date().toISOString()}`)
3. "LinkedIn에 발행" 클릭
4. URN 표시 확인
5. 본인 LinkedIn 프로필 새로고침 → 글이 실제로 올라가 있는지 확인
6. **테스트 잔여물 제거**: LinkedIn 웹에서 본인이 직접 삭제

### 5. Playwright E2E 실행

Chromium 설치가 자동 완료되었다면:
```bash
cd ~/Desktop/Code/onepost
pnpm e2e
```

E2E 시드 유저는 `scripts/seed-e2e-user.mjs`로 자동 생성되어 `.env.local`에 자격증명이 들어가 있습니다.

만약 Chromium 설치가 안 됐다면:
```bash
pnpm dlx playwright install chromium
```

### 6. (선택) 결과물 평가

문제 없으면 GitHub에 푸시:
```bash
cd ~/Desktop/Code/onepost
gh repo create onepost --private --source=. --remote=origin --push
```

## 다음 Plan으로 가려면

Plan 1이 완전히 검증되면 Plan 2 (Threads + Instagram + 인스타 카드) 작성 → 실행 들어가면 됩니다.

전체 디자인 문서: `~/Desktop/Code/TheReader_Project/docs/superpowers/specs/2026-05-26-onepost-design.md`
Plan 1 문서: `~/Desktop/Code/TheReader_Project/docs/superpowers/plans/2026-05-26-onepost-01-foundation-linkedin.md`

## 알려진 이슈 / 주의사항

1. **shadcn 4.x Nova vs Classic**: 플랜에서는 classic shadcn 사용 가정이었으나 실제로는 4.x Nova가 설치되며 lib/utils와 components/ui를 안 만들었습니다. → **수동으로 lib/utils.ts와 5개 컴포넌트(Button, Input, Label, Card, Textarea)를 작성**해서 해결. 기능적으로 동일.

2. **pnpm 11**: msw 빌드 스크립트 차단 이슈 → `pnpm-workspace.yaml` 에 `allowBuilds.msw: false` 추가로 해결.

3. **사용 안 하는 의존성**: `@base-ui/react`, `shadcn`, `tw-animate-css` 가 shadcn init이 추가했으나 실제로 import되지 않음. 마음 편하면 `pnpm remove @base-ui/react shadcn tw-animate-css` 로 제거 가능.

4. **LinkedIn OAuth Redirect URI**: 개발자 앱에 등록된 URI는 `http://localhost:3000/api/linkedin/oauth/callback`. 배포 시 운영 도메인용 URI 추가 등록 필요.

5. **Server Actions과 redirect**: `signIn` 후 redirect가 throw로 처리됨 — 정상이며 Next.js가 자동으로 변환. 클라이언트 측 에러 핸들링은 `result.error`만 신경쓰면 됨.
