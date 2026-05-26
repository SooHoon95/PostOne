# TODO — 사용자가 직접 처리할 항목

## ✅ 자동 완료된 것

### Plan 1 (커밋 10개)
- Next.js 14 + Tailwind + shadcn-style UI + Vitest 스캐폴드
- Supabase 인증 (Sign Up / Sign In / 미들웨어 / 보호 라우트)
- AES-256-GCM 토큰 암호화 + `TOKEN_ENCRYPTION_KEY` 자동 생성
- LinkedIn OAuth + 발행 API + 발행 이력
- **LinkedIn API 버전 픽스** (202405 → 202509, 426 NONEXISTENT_VERSION 해결)
- Playwright 스모크 E2E + 시드 유저 자동 생성

### Plan 2 (커밋 추가, Threads + Instagram + 카드 자동 생성)
- DB 마이그레이션 `0002_add_threads_instagram.sql` (작성됨, 실행 필요)
- **Threads**: OAuth (short → long-lived token), 2-step publish (container → publish)
- **Instagram**: Facebook OAuth, Pages → IG Business 자동 매핑, 단일/캐러셀 발행
- **카드 자동 생성**: Satori + Resvg → PNG → Supabase Storage 업로드
- 3개 템플릿: minimal-white / gradient / photo-overlay
- Pretendard 폰트 CDN 자동 로드 (한국어 대응)
- **멀티 채널 에디터 UI**: 채널 체크박스 + Instagram 옵션(템플릿/제목) + 결과 표시
- 채널별 글자수 검증 (LinkedIn 3000 / Threads 500 / IG 2200)

### 검증 결과
- 단위 테스트: **45개 통과** ✅
- TypeScript: 컴파일 오류 0 ✅
- 프로덕션 빌드: 14개 라우트 정상 ✅

---

## 🛑 사용자 수동 처리 항목 (회사에서 돌아온 후)

### 1. Supabase 마이그레이션 0002 실행 ⚠️ 필수

**없으면 Threads/Instagram 발행 시 DB 에러로 실패합니다.**

1. https://supabase.com/dashboard → onepost 프로젝트 → **SQL Editor**
2. **New query** → `~/Desktop/Code/onepost/supabase/migrations/0002_add_threads_instagram.sql` 내용 전체 붙여넣기
3. **Run**
4. Table Editor에서 `threads_connections`, `instagram_connections` 테이블 + `posts.media_urls` 컬럼 생성 확인

또는 터미널에서:
```bash
cat ~/Desktop/Code/onepost/supabase/migrations/0002_add_threads_instagram.sql | pbcopy
```
하고 콘솔에 붙여넣기.

### 2. Supabase Storage 버킷 생성 (Instagram 카드 호스팅용) ⚠️ 필수

Instagram은 공개 URL 이미지가 필요합니다.

1. Supabase 콘솔 → **Storage** → **New bucket**
2. Name: `cards`
3. **Public bucket 체크** ✅ (Instagram CDN이 크롤할 수 있어야 함)
4. **Save**

### 3. Meta Developer Portal 앱 생성 (Threads + Instagram 공통)

1. https://developers.facebook.com/apps → **Create App**
2. Use case: **Other** 또는 **Customize**
3. App type: **Business**
4. App name: `OnePost (Dev)` / 이메일 입력 → Create

#### 3-A. Threads API 추가
1. 사이드바 **Add Product** → **Threads API** → Set Up
2. **Settings** → OAuth redirect URI에 추가:
   ```
   http://localhost:3000/api/threads/oauth/callback
   ```
3. **App ID** + **App Secret** 메모 (Threads용)

#### 3-B. Instagram Graph API + Facebook Login 추가
1. 같은 앱에 **Add Product** → **Instagram → Instagram Graph API** Set Up
2. 또 추가 **Add Product** → **Facebook Login → Web** Set Up
3. **Facebook Login → Settings** → Valid OAuth Redirect URIs에 추가:
   ```
   http://localhost:3000/api/instagram/oauth/callback
   ```
4. Settings → Basic에서 다시 한 번 **App ID** + **App Secret** 메모 (Instagram용 — 같은 앱이면 같은 값)

> 💡 Meta는 하나의 앱에 Threads + Instagram + Facebook Login 다 붙일 수 있습니다.
> 같은 App ID/Secret 을 `THREADS_*`와 `INSTAGRAM_*` 양쪽에 넣어도 OK.
> 단, OAuth redirect URI는 둘 다 등록해야 함.

### 4. Instagram 계정 사전 준비

Instagram API는 **Business/Creator 계정만** 지원합니다.

1. 본인 Instagram 앱에서:
   - **설정 → 계정 → 프로페셔널 계정으로 전환** (없으면)
   - **비즈니스** 또는 **크리에이터** 선택
2. **Facebook Page**와 연결:
   - Facebook에서 본인 Page (없으면 새로 생성)
   - Instagram 앱 → 설정 → **연결된 계정** → Facebook → 연결

이거 안 하면 OAuth 콜백에서 *"Instagram Business 계정이 연결된 Facebook Page를 찾을 수 없습니다"* 에러.

### 5. `.env.local`에 신규 값 채우기

`~/Desktop/Code/onepost/.env.local` 편집기로 열어서:

```bash
THREADS_CLIENT_ID=<3-A에서 얻은 App ID>
THREADS_CLIENT_SECRET=<3-A에서 얻은 App Secret>
THREADS_REDIRECT_URI=http://localhost:3000/api/threads/oauth/callback

INSTAGRAM_APP_ID=<3-B에서 얻은 App ID — 보통 THREADS_CLIENT_ID와 동일>
INSTAGRAM_APP_SECRET=<3-B에서 얻은 App Secret — 보통 동일>
INSTAGRAM_REDIRECT_URI=http://localhost:3000/api/instagram/oauth/callback
```

저장 후 dev 서버 **재시작** (`Ctrl+C` 후 `pnpm dev` 다시).

### 6. dev 서버 띄우고 전체 흐름 검증

```bash
cd ~/Desktop/Code/onepost
pnpm dev
```

1. http://localhost:3000/login → 로그인
2. `/settings/connections` → **3개 채널 카드** (LinkedIn ✅ / Threads / Instagram) 표시 확인
3. **Threads "연결하기"** → Meta 로그인 → 권한 동의 → `?connected=threads` 확인
4. **Instagram "연결하기"** → 동일 흐름 → `?connected=instagram` 확인
5. `/compose` → 본문 작성 + **3개 채널 체크** + Instagram 옵션 (제목/템플릿) → 발행
6. 결과 카드에 채널별 성공/실패 확인
7. 실제 Threads, Instagram 프로필 새로고침 → 글 + 캐러셀 이미지 노출 확인

### 7. 테스트 잔여물 제거

본인 LinkedIn / Threads / Instagram에서 테스트 글 직접 삭제.

### 8. (선택) GitHub 푸시

```bash
cd ~/Desktop/Code/onepost
gh repo create onepost --private --source=. --remote=origin --push
```

---

## 알려진 이슈 / 주의사항

1. **LinkedIn API 버전**: 현재 `202509` 사용. LinkedIn은 매월 새 버전을 내고 12개월 후 만료. 만료되면 `lib/linkedin/client.ts`의 `VERSION` 상수 갱신 필요.

2. **Instagram 검토 모드**:
   - 개발 모드에서는 **앱 관리자/개발자/테스터 본인 계정만** 발행 가능
   - 다른 사용자에게 풀려면 Meta App Review 통과 필요 (스코프별 검토)

3. **Threads 일일 한도**: 사용자당 250 게시물/일. 무제한 발행 마케팅 시 주의.

4. **인스타 카드 폰트**: Pretendard를 jsdelivr CDN에서 첫 호출 시 다운로드 → 메모리 캐시. 첫 발행만 약간 느림 (~1-2초). 이후 캐시됨.

5. **Supabase Storage `cards` 버킷**: Public 으로 설정해야 Instagram CDN이 이미지를 가져옴. 만약 보안 우려가 있으면 v1.1에서 signed URL 방식으로 전환 검토.

6. **shadcn Nova 미사용 의존성**: `@base-ui/react`, `shadcn`, `tw-animate-css` 가 install 부산물로 들어있음. 정리하려면 `pnpm remove @base-ui/react shadcn tw-animate-css`.

7. **`scripts/seed-e2e-user.mjs`**: 이미 1회 실행되어 .env.local에 `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` 들어가 있음. 재실행하면 새 유저 생성됨 (의도된 동작).

---

## 문서

- 디자인: `~/Desktop/Code/TheReader_Project/docs/superpowers/specs/2026-05-26-onepost-design.md`
- Plan 1: `~/Desktop/Code/TheReader_Project/docs/superpowers/plans/2026-05-26-onepost-01-foundation-linkedin.md`
- Plan 2: 별도 문서 없음 (디자인 문서 + 이 TODO + 커밋 메시지 참고)
