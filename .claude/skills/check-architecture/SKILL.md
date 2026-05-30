---
name: check-architecture
description: PostOne 레이어/의존/채널 격리 규칙 위반 점검. 새 모듈 추가, import 변경, 리팩터 후 커밋 전에 사용.
---

# check-architecture

## 규칙

- **의존 방향**: `app`(route/server action) → `lib`(도메인) → 외부(supabase/채널 API). `components` → `lib`. 역참조 금지.
- **채널 격리**: `lib/linkedin`·`lib/threads`·`lib/instagram`은 서로 import 금지. 공통 로직은 `lib/utils`·`lib/crypto`·`lib/supabase`로.
- **시크릿 경계**: 서버 전용 시크릿(`*_SECRET`, `SERVICE_ROLE`, `TOKEN_ENCRYPTION_KEY`)은 서버 코드에서만. `"use client"` 파일에서 `NEXT_PUBLIC_` 아닌 env 참조 금지.

## 점검 (grep)

```bash
# 채널 교차 import
grep -rn -E "lib/(linkedin|threads|instagram)" lib/linkedin lib/threads lib/instagram 2>/dev/null
# 클라이언트 컴포넌트의 서버 시크릿 노출 (lookahead 미지원 환경 호환)
grep -rln '"use client"' app components | xargs grep -nE "process\.env\.[A-Z]" 2>/dev/null | grep -v "NEXT_PUBLIC_"
# lib → app 역참조
grep -rn "from \"@/app" lib 2>/dev/null
```

하드코딩 색/디자인 토큰 위반은 `review-design` 스킬에서 다룬다.

## 처리

위반 발견 시 **수정안을 먼저 제시**하고 동의 후 수정. 단순 위반이라도 자동 수정 전 한 줄 보고.
