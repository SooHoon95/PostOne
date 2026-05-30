---
name: verify-build
description: PostOne 빌드/품질 검증. 코드 변경을 완료로 선언하거나 커밋·push 하기 전에 사용. pnpm build→lint→test 순서와 통과 기준, 자주 겪는 함정 포함.
---

# verify-build

코드 변경을 **완료로 선언하기 전 반드시** 이 순서로 검증한다. 빌드는 오래 걸리니 `run_in_background`로 돌린다.

## 순서

1. `pnpm build` — 타입체크 + 컴파일. 로그 본문에서 `Compiled successfully`(성공) / `Failed`·`Module not found`·`Type error`(실패)를 **직접 grep**한다.
2. `pnpm lint` — 변경 파일의 경고/에러.
3. `pnpm test` — vitest. 변경 영역과 관련된 테스트가 통과하는지.
4. 인증/세션/채널 OAuth/결제 변경 시 → `pnpm e2e` 또는 **브라우저 수동 확인 케이스를 사용자에게 명시**.

## 통과 기준

- 빌드 실패 시 절대 완료 선언·커밋 금지.
- 에러는 핵심만 인용한다(전체 스택 트레이스 반복 금지 — 토큰 낭비).
- 런타임 동작(쿠키 만료, 세션 유지, OAuth 콜백)은 빌드로 검증 **불가** → 사용자에게 직접 확인할 케이스를 적어준다.

## 함정 (실제 겪은 것)

- **npm 쓰지 마라.** 이 레포는 pnpm 전용. `npm install`은 `Cannot read properties of null (reading 'matches')`로 실패하고 lockfile을 깬다. 의존성은 `pnpm add`.
- `cmd && echo EXIT:$?` 같은 파이프라인의 종료코드는 **마지막 명령** 코드다. 빌드 성공 여부는 exit code가 아니라 **로그 본문**으로 판정하라.
