# PostOne

링크드인·스레드·인스타그램에 **한 번 써서 동시 발행**하는 멀티채널 퍼블리싱 SaaS. 한국 직장인 타깃. 인스타 카드뉴스 자동 생성이 차별점.
스택: Next.js 14(App Router) · TypeScript · Tailwind(shadcn 토큰) · Supabase(Auth/DB/Storage) · Vercel 배포.

## 명령 (pnpm 전용 — npm 금지)

- `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm test`(vitest) · `pnpm e2e`(playwright)
- ⚠️ 이 레포는 `pnpm-lock.yaml` 기반이다. `npm install` 쓰지 마라 — lockfile/구조가 깨진다. 의존성 추가는 `pnpm add`.

## 대전제 (규칙)

- **보안**: `.env.local`은 절대 커밋·push 금지(.gitignore 확인). 시크릿은 Vercel 대시보드에만. 평문 노출·문서 업로드 금지.
- **레이어 의존 방향**: `app`(route/server action) → `lib`(도메인 로직) → 외부(supabase/채널 API). `components` → `lib`. 역참조 금지.
- **채널 격리**: `lib/{linkedin,threads,instagram}`는 서로 import 금지. 공통은 `lib/utils`·`lib/crypto`·`lib/supabase`.
- **디자인**: 하드코딩 색(`slate-*`, `bg-white` 등) 금지 — `globals.css` 토큰(`bg-card`, `text-muted-foreground`, `primary`, `channel-*`)만. 라이트/다크 양립.
- **커밋**: `feat|fix|refactor|style|test|docs|build|chore|ci|WIP` + 단일 목적. Co-Authored-By 금지.
- **push**: `main` 직접 push가 이 프로젝트 관행(Vercel 자동 배포). 단 **사용자 명시 승인 후**.
- **설정/규칙 파일**(CLAUDE.md, .claude/**, docs/**) 수정은 계획 제시 → 동의 후 적용.

## Opus 4.8 운영 원칙

- **effort 기본값**: 일반=High · 코딩/에이전트=X High · 짧은 작업=Medium · 대형 전체 구현=Ultra Code. 결과가 얕으면 프롬프트보다 **effort부터** 올린다.
- 항상 **계획 → 실행 → 검수**. 수정 전 계획을 보여주고, 수정 후엔 변경사항과 남은 리스크를 구분해 보고.
- **범위 제한**: 목표와 무관한 확장·리팩터 금지. 단 실제 오류/보안 리스크가 보이면 별도로 알린다.
- **토큰 절약**: 필요한 파일만 읽고/수정한다. 첫 지시에 맥락·성공 기준을 박는다. 여러 턴으로 끌지 않는다.
- **anti-laziness 프롬프트 금지**("계속해/멈추지마/N번마다 보고") — 4.8에선 과해진다.
- "하지 마"보다 **"이렇게 해"**. 불확실하면 추측 말고 '확인 필요'로 표시.
- 상세 템플릿/스니펫: `docs/opus48-templates.md`.

## 스킬 라우팅 (`.claude/skills/`)

| 트리거 | 스킬 |
|---|---|
| 코드 변경 후 완료 주장·커밋·push 전 검증 | `verify-build` |
| 의존·레이어·채널 격리 위반 점검 | `check-architecture` |
| UI 토큰·다크모드·디자인 일관성 | `review-design` |
| 기능/버그 작업 후 코드 리뷰(2단계) | `review-code` |
| PRD/작업 생성·갱신 | `manage-tasks` |

## Task 관리

- 작업 보드 `docs/TASKS.md` · 제품 요구사항 `docs/PRD.md` · 프롬프트 템플릿 `docs/opus48-templates.md`.
- 세션 시작 시 SessionStart hook이 `TASKS.md`를 자동 주입한다. compact 직전엔 PreCompact hook이 갱신을 리마인드한다.
- 작업 착수 시 항목을 in-progress로, 완료 시 done + PRD 로드맵 반영. 마일스톤·기능 완료·compact 직전마다 갱신(`manage-tasks` 스킬).
