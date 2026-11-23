# PostOne Bridge (크롬 익스텐션)

PostOne에서 AI로 변환한 초안을 **Peerlist · Reddit 글쓰기 창**까지 한 번에 옮기는 확장.
두 서비스 모두 공개 발행 API가 없거나(Peerlist) 승인 전이므로(Reddit — Responsible Builder
Policy로 신규 OAuth 앱 생성 제한), 확장이 초안을 받아 글쓰기 창에 채워 주고 **게시는 사용자가 직접** 누른다.

- Peerlist: PostOne 글쓰기 → AI 채널별 변환 → Peerlist 블록 → **Peerlist 확장으로 전송**
- Reddit: 같은 화면의 Reddit 블록 → **Reddit 확장으로 전송**(제목·본문·서브레딧 힌트)
- 출력: 툴바 확장 아이콘 → **작성창에 채우기** → 사이트에서 내용 확인 → 직접 게시

Manifest V3 · 빌드 없는 순수 JS/HTML/CSS. pnpm·Next 빌드와 무관하게 그대로 로드한다.

## 설치 (Load unpacked)

1. Chrome 주소창에 `chrome://extensions` 입력
2. 오른쪽 위 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 저장소의 `extension/` 폴더 선택 (예: `/workspace/PostOne/extension`)
5. 목록에 **PostOne Bridge**가 보이면 완료. 툴바에 퍼즐 아이콘 → 압정으로 고정 권장

> 이미 설치한 확장은 `chrome://extensions`에서 **새로고침** 아이콘을 누르면 갱신된다.
> 갱신·설치 후 이미 열려 있던 PostOne·Peerlist·Reddit 탭도 새로고침해야 content script가 붙는다.

## 사용 흐름

### Peerlist

1. PostOne 글쓰기(`/compose`)에서 본문 작성 → **AI 변환** → Peerlist 블록 확인
2. **Peerlist 확장으로 전송** 클릭 (확장이 없으면 클립보드 복사로 대체)
3. Peerlist(`https://peerlist.io`)에서 글쓰기 창(composer) 열기
4. 툴바의 **PostOne Bridge** 아이콘 → Peerlist 초안 확인·수정 → **작성창에 채우기**
5. Peerlist에서 내용을 확인하고 **직접 게시**

### Reddit (OAuth 미연결 상태에서도 사용)

1. 같은 화면의 **Reddit** 블록에서 AI 변환된 제목·본문 확인 (서브레딧은 글쓰기 화면의 서브레딧 입력값을 힌트로 사용)
2. **Reddit 확장으로 전송** 클릭 (확장이 없으면 제목+본문 복사로 대체)
3. 툴바 아이콘 → Reddit 초안 확인 → **Reddit 열기**
   - 서브레딧 힌트가 유효하면 `reddit.com/r/<sub>/submit?type=TEXT`, 아니면 `reddit.com/submit?type=TEXT`
   - `?type=TEXT`로 본문(text) 탭이 바로 열린다
4. **작성창에 채우기** → 제목·본문이 들어간다
   - `/submit`(커뮤니티 선택 화면)에서 서브레딧 입력란을 찾으면 힌트를 채워 주고, 못 찾으면 직접 선택 안내
5. Reddit에서 내용을 확인하고 **직접 Post**

확장은 게시(Submit/Post) 버튼을 **절대 자동 클릭하지 않는다**. 네트워크 요청도 보내지 않는다.

## 구성

| 파일 | 역할 |
|---|---|
| `manifest.json` | MV3 정의 — `storage`·`activeTab`·`tabs`, host: Peerlist·Reddit·PostOne(prod/localhost) |
| `content-postone.js` | PostOne 페이지에서 `POSTONE_PEERLIST_DRAFT`·`POSTONE_REDDIT_DRAFT` 수신 → background에 저장 위임 → `POSTONE_EXTENSION_ACK` 회신. 로드 시 `POSTONE_EXTENSION_READY` 알림, `POSTONE_EXTENSION_PING`에 응답 |
| `content-peerlist.js` | Peerlist 작성창(textarea·contenteditable·ProseMirror/TipTap) 탐색 후 초안 삽입 |
| `content-reddit.js` | Reddit 글쓰기 창(`/submit`, `/r/*/submit`)의 제목·본문(contenteditable 리치 에디터)·서브레딧 입력란 탐색 후 초안 삽입. Reddit 새 UI는 작성 폼이 **open shadow root** 안에 있어 document 질의만으로는 찾지 못하므로 shadow root를 재귀 탐색한다 |
| `background.js` | 초안 저장/조회 단일 창구(`chrome.storage.local`), 탭 열기/포커스, 채우기 메시지 중계, 배지 피드백 |
| `popup.html` · `popup.css` · `popup.js` | Peerlist·Reddit 초안 보기·수정, 글자수, **열기**, **작성창에 채우기** |

### 메시지 계약

웹 쪽 구현·테스트: `lib/extension/peerlist-bridge.ts`(채널 공용), `lib/extension/reddit-draft.ts`, `lib/hooks/use-peerlist-extension.ts`

| 방향 | type | payload |
|---|---|---|
| 웹 → content | `POSTONE_EXTENSION_PING` | — |
| content → 웹 | `POSTONE_EXTENSION_READY` | `{ version }` |
| 웹 → content | `POSTONE_PEERLIST_DRAFT` | `{ content, updatedAt }` |
| 웹 → content | `POSTONE_REDDIT_DRAFT` | `{ subreddit, title, body, updatedAt }` |
| content → 웹 | `POSTONE_EXTENSION_ACK` | `{ ok, message? }` |

내부(팝업 → background → content):

| type | payload |
|---|---|
| `POSTONE_GET_DRAFT` / `POSTONE_GET_REDDIT_DRAFT` | — |
| `POSTONE_SAVE_DRAFT` / `POSTONE_SAVE_REDDIT_DRAFT` | 초안 |
| `POSTONE_OPEN_PEERLIST` / `POSTONE_OPEN_REDDIT` | `{ subreddit? }` |
| `POSTONE_FILL_PEERLIST` | `{ content }` |
| `POSTONE_FILL_REDDIT` | `{ subreddit, title, body }` |

저장 키: `chrome.storage.local["peerlistDraft"] = { content, updatedAt }`,
`chrome.storage.local["redditDraft"] = { subreddit, title, body, updatedAt }`

## 문제 해결

- **PostOne에 "확장 미설치"로 표시**: `chrome://extensions`에서 확장이 켜져 있는지 확인 → PostOne 탭 새로고침. 확장을 새로 로드했다면 탭 새로고침 필수.
- **"Peerlist 작성창을 찾지 못했습니다"**: Peerlist에서 글쓰기 창을 먼저 연 뒤 다시 시도. 모달이 늦게 뜨면 2초까지 기다렸다가 찾는다.
- **"Reddit 제목 입력창을 찾지 못했습니다"**: `reddit.com/submit` 글쓰기 화면을 연 뒤 다시 시도.
- **"본문 편집창을 찾지 못했습니다"**: Reddit 글쓰기 화면에서 **Text** 탭을 선택한 뒤 다시 시도(Images/Link 탭에는 본문 편집창이 없다). Reddit이 작성 폼을 닫힌(closed) shadow root로 바꾸면 확장에서는 접근할 수 없어 이 안내가 뜬다 — 이 경우 초안 복사로 대체한다.
- **서브레딧이 비어 있음**: `/submit`은 커뮤니티를 직접 골라야 한다. 확장이 입력란을 못 찾으면 직접 선택한 뒤 게시.
- **글은 들어갔는데 게시 버튼이 비활성**: 편집기가 상태를 못 받은 경우다. 작성창을 한 번 클릭한 뒤 스페이스 입력/삭제로 상태를 깨우거나, 초안을 복사해 붙여넣는다.
- **"페이지를 새로고침한 뒤..."**: 확장 재로드 후 기존 탭에 content script가 없어서 생긴다. 새로고침하면 해결.
- **글자수 초과**: Peerlist 700자는 PostOne 제품 가드(AI 초안 길이), Reddit은 제목 300자·본문 40000자 제한.

## 권한 설명

- `storage`: 초안 보관 (`chrome.storage.local`)
- `tabs` · `activeTab`: Peerlist·Reddit 탭 찾기·열기·포커스, 채우기 메시지 전달
- host 권한: `https://peerlist.io/*`, `https://www.reddit.com/*`, `https://postone-sigma.vercel.app/*`, `http://localhost:3000/*`
- 서버 전송 없음. 초안은 브라우저 로컬 저장소에만 남는다.
