---
name: manage-tasks
description: PostOne PRD/TASKS 생성·갱신. 기능 기획, 작업 착수/완료, 마일스톤 도달, compact 직전, 세션 종료 시 사용.
---

# manage-tasks

파일: `docs/PRD.md`(제품 요구사항·로드맵), `docs/TASKS.md`(작업 보드).

## 갱신 시점 (주기)

- **작업 착수**: TASKS.md 항목 `[ ]` → `[~]`(in progress).
- **작업 완료**: `[~]` → `[x]` + 완료일, 그리고 PRD 로드맵의 해당 항목 반영.
- **새 요구/아이디어**: PRD "백로그"에 추가 → TASKS로 분해.
- **compact 직전 / 세션 종료**: 현재 진행 상황을 TASKS.md에 반영(PreCompact hook이 리마인드).

## TASKS.md 형식

섹션: `## In Progress` / `## To Do` / `## Done (최근)`. 항목:

```
- [~] 제목 — 영역(파일/모듈) · 비고
```

## PRD.md 구조

1. 비전/타깃 2. MVP 범위 3. 기능 로드맵(Now / Next / Later) 4. 비기능(보안/성능) 5. 백로그.

## 원칙

- TASKS는 **짧게** 유지 — Done은 최근 항목만 남기고 정리한다. 전체 이력은 `git log`에 있다.
- 작업 단위는 **한 번에 검증 가능한 크기**로 분해(Opus 4.8: 큰 작업은 계획→단계 분할).
- 토큰 절약: 갱신 시 파일 전체를 다시 쓰지 말고 변경된 항목만 Edit.
