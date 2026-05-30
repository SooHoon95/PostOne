---
name: review-design
description: PostOne 디자인 토큰·다크모드·테마 일관성 검증. UI(.tsx) 추가·수정 후, 또는 새 화면 디자인 시 사용.
---

# review-design

테마: **Indigo shadcn 토큰, 라이트 우선 + 다크**. `app/globals.css` CSS 변수 기반, `tailwind.config.ts` 매핑.

## 점검

```bash
# 하드코딩 색 0건이어야 한다 (components/ui 제외)
grep -rnE "(bg|text|border|ring)-(slate|gray|zinc|neutral|stone)-[0-9]+|bg-white|text-black|text-white" app components --include="*.tsx" | grep -v "components/ui/"
```

## 토큰 매핑

| 용도 | 토큰 |
|---|---|
| 페이지/앱 배경 | `bg-background` |
| 카드·네비·입력 표면 | `bg-card` |
| 보조 표면(빈 박스 등) | `bg-muted` |
| 본문 텍스트 | `text-foreground` |
| 보조 텍스트 | `text-muted-foreground` |
| 구분선 | `border` |
| 입력 테두리 | `border-input` |
| 브랜드 강조 | `primary` / `brand` / `brand-accent` |
| 채널 색 | `channel-linkedin` / `channel-threads` / `channel-instagram` |
| 오류 | `text-destructive` |

## 기준

- 새 컴포넌트는 라이트/다크 양쪽에서 대비 확보(`.dark` 토큰 자동 적용). 임의 hex 금지(단 Satori 카드 생성은 예외 — 이미지 렌더링).
- 폰트: 본문 Pretendard, 코드 Geist Mono. 임의 폰트 추가 금지.

## 디자인 작업 방식 (Opus 4.8)

새 화면이나 큰 UI는 **구현 전 비주얼 방향 옵션**(배경 hex·액센트·폰트·레이아웃 구조·적합 이유)을 먼저 제시하고, 선택받은 방향만 구현한다.
