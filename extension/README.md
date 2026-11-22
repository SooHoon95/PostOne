# PostOne Peerlist Bridge (크롬 익스텐션)

PostOne에서 AI로 변환한 **Peerlist 초안**을 Peerlist 작성창까지 한 번에 옮기는 확장.
Peerlist는 공개 발행 API가 없어서, 확장이 초안을 받아 글쓰기 창에 채워 주고 **게시는 사용자가 직접** 누른다.

- 입력: PostOne 글쓰기 화면 → AI 채널별 변환 → Peerlist 블록 → **Peerlist 확장으로 전송**
- 출력: 툴바 확장 아이콘 → **작성창에 채우기** → Peerlist에서 내용 확인 → 직접 게시

Manifest V3 · 빌드 없는 순수 JS/HTML/CSS. pnpm·Next 빌드와 무관하게 그대로 로드한다.

## 설치 (Load unpacked)

1. Chrome 주소창에 `chrome://extensions` 입력
2. 오른쪽 위 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 저장소의 `extension/` 폴더 선택
   (예: `/workspace/PostOne/extension`)
5. 목록에 **PostOne Peerlist Bridge**가 보이면 완료. 툴바에 퍼즐 아이콘 → 압정으로 고정 권장

> 설치/업데이트 후 이미 열려 있던 PostOne·Peerlist 탭은 새로고침해야 content script가 붙는다.

## 사용 흐름

1. PostOne 글쓰기(`/compose`)에서 본문 작성 → **AI 변환** → Peerlist 블록 확인
2. **Peerlist 확장으로 전송** 클릭
   - 확장이 없으면 자동으로 **클립보드 복사**로 대체되고 안내 문구가 뜬다
3. Peerlist(`https://peerlist.io`)에서 글쓰기 창(composer) 열기
4. 툴바의 **PostOne Peerlist** 아이콘 클릭
   - 저장된 초안이 보이고, 필요하면 팝업에서 바로 수정 가능 (수정분은 자동 저장)
   - **작성창에 채우기** 클릭 → 작성창에 텍스트가 들어간다
5. Peerlist에서 내용을 확인하고 **직접 게시**

확장은 게시(Submit/Post) 버튼을 **절대 자동 클릭하지 않는다**.

## 구성

| 파일 | 역할 |
|---|---|
| `manifest.json` | MV3 정의 — `storage`·`activeTab`·`tabs`, host: Peerlist·PostOne(prod/localhost) |
| `content-postone.js` | PostOne 페이지에서 `POSTONE_PEERLIST_DRAFT` 수신 → 배경에 저장 위임 → `POSTONE_EXTENSION_ACK` 회신. 로드 시 `POSTONE_EXTENSION_READY` 알림, `POSTONE_EXTENSION_PING`에 응답 |
| `content-peerlist.js` | Peerlist 작성창(textarea·contenteditable·ProseMirror/TipTap) 탐색 후 초안 삽입. React state 갱신용 `input`/`change` 이벤트 발생 |
| `background.js` | 초안 저장/조회 단일 창구(`chrome.storage.local`), Peerlist 탭 열기/포커스, 채우기 메시지 중계, 배지 피드백 |
| `popup.html` · `popup.css` · `popup.js` | 초안 보기·수정, 글자수, **Peerlist 열기**, **작성창에 채우기** |

### 메시지 계약

웹 쪽 구현·테스트: `lib/extension/peerlist-bridge.ts`, `lib/hooks/use-peerlist-extension.ts`

| 방향 | type | payload |
|---|---|---|
| 웹 → content | `POSTONE_EXTENSION_PING` | — |
| content → 웹 | `POSTONE_EXTENSION_READY` | `{ version }` |
| 웹 → content | `POSTONE_PEERLIST_DRAFT` | `{ content, updatedAt }` |
| content → 웹 | `POSTONE_EXTENSION_ACK` | `{ ok, message? }` |

저장 키: `chrome.storage.local["peerlistDraft"] = { content, updatedAt }`

## 문제 해결

- **PostOne에 "확장 미설치"로 표시**: `chrome://extensions`에서 확장이 켜져 있는지 확인 → PostOne 탭 새로고침. 확장을 새로 로드했다면 탭 새로고침 필수.
- **"Peerlist 작성창을 찾지 못했습니다"**: Peerlist에서 글쓰기 창을 먼저 연 뒤 다시 시도. 모달이 늦게 뜨면 2초까지 기다렸다가 찾는다.
- **글은 들어갔는데 Peerlist 게시 버튼이 비활성**: 편집기가 상태를 못 받은 경우다. 작성창을 한 번 클릭한 뒤 스페이스 입력/삭제로 상태를 깨우거나, 초안을 복사해 붙여넣는다.
- **"Peerlist 페이지를 새로고침한 뒤..."**: 확장 재로드 후 기존 탭에 content script가 없어서 생긴다. 새로고침하면 해결.
- **글자수 700 초과**: Peerlist 제한이 아니라 PostOne 제품 가드(AI 초안 길이)다. 팝업에서 줄이거나 그대로 게시 가능.

## 권한 설명

- `storage`: 초안 보관 (`chrome.storage.local`)
- `tabs` · `activeTab`: Peerlist 탭 찾기·열기·포커스, 채우기 메시지 전달
- host 권한: `https://peerlist.io/*`, `https://postone-sigma.vercel.app/*`, `http://localhost:3000/*`
- 서버 전송 없음. 초안은 브라우저 로컬 저장소에만 남는다.
