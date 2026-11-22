/**
 * PostOne Peerlist Bridge — background service worker.
 *
 * 책임:
 * - 초안 저장/조회의 단일 창구(chrome.storage.local, 키 `peerlistDraft`)
 * - PostOne content script의 저장 요청 중계
 * - 팝업의 "Peerlist 열기" 탭 열기/포커스
 * - 팝업의 "작성창에 채우기"를 Peerlist 탭 content script로 전달 + 배지 피드백
 */
const DRAFT_STORAGE_KEY = "peerlistDraft";
const PEERLIST_HOME_URL = "https://peerlist.io/";
const PEERLIST_URL_PATTERN = "https://peerlist.io/*";
const MAX_CONTENT_LENGTH = 20000;

function isDraft(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.content === "string" &&
    typeof value.updatedAt === "string"
  );
}

function getDraft() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DRAFT_STORAGE_KEY, (result) => {
      const draft = result && result[DRAFT_STORAGE_KEY];
      resolve(isDraft(draft) ? draft : null);
    });
  });
}

function saveDraft(payload) {
  const content =
    payload && typeof payload.content === "string" ? payload.content : "";
  if (!content.trim()) {
    return Promise.resolve({ ok: false, message: "초안 본문이 비어 있습니다." });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return Promise.resolve({ ok: false, message: "초안이 너무 깁니다." });
  }
  const updatedAt =
    payload && typeof payload.updatedAt === "string" && payload.updatedAt
      ? payload.updatedAt
      : new Date().toISOString();

  return new Promise((resolve) => {
    chrome.storage.local.set(
      { [DRAFT_STORAGE_KEY]: { content, updatedAt } },
      () => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            message: chrome.runtime.lastError.message || "초안 저장 실패",
          });
          return;
        }
        resolve({ ok: true, draft: { content, updatedAt } });
      }
    );
  });
}

async function flashBadge(text, color) {
  if (!chrome.action) return;
  try {
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "" }).catch(() => {});
    }, 4000);
  } catch {
    // 배지는 보조 피드백 — 실패해도 동작에 영향 없음
  }
}

async function openPeerlist() {
  const tabs = await chrome.tabs.query({ url: PEERLIST_URL_PATTERN });
  if (tabs.length > 0) {
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    if (typeof tab.windowId === "number") {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    return { ok: true, opened: "existing" };
  }
  await chrome.tabs.create({ url: PEERLIST_HOME_URL });
  return { ok: true, opened: "new" };
}

async function fillPeerlist(payload) {
  const content =
    payload && typeof payload.content === "string" ? payload.content : "";
  if (!content.trim()) {
    return { ok: false, message: "초안이 비어 있습니다." };
  }

  const tabs = await chrome.tabs.query({ url: PEERLIST_URL_PATTERN });
  if (tabs.length === 0) {
    return {
      ok: false,
      reason: "no-peerlist-tab",
      message: "Peerlist 탭을 먼저 열어 주세요.",
    };
  }

  const tab = tabs[0];
  await chrome.tabs.update(tab.id, { active: true });
  if (typeof tab.windowId === "number") {
    await chrome.windows.update(tab.windowId, { focused: true });
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "POSTONE_PEERLIST_FILL",
      content,
    });
    const ok = Boolean(response && response.ok);
    await flashBadge(ok ? "✓" : "!", ok ? "#16a34a" : "#dc2626");
    return response || {
      ok: false,
      message: "Peerlist 응답이 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    };
  } catch {
    await flashBadge("!", "#dc2626");
    return {
      ok: false,
      reason: "no-content-script",
      message: "Peerlist 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DRAFT_STORAGE_KEY, () => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  switch (message.type) {
    case "POSTONE_GET_DRAFT":
      getDraft().then((draft) => sendResponse({ ok: true, draft }));
      return true;
    case "POSTONE_SAVE_DRAFT":
      saveDraft(message.payload).then(sendResponse);
      return true;
    case "POSTONE_OPEN_PEERLIST":
      openPeerlist()
        .then(sendResponse)
        .catch((error) =>
          sendResponse({
            ok: false,
            message:
              error instanceof Error ? error.message : "Peerlist 열기 실패",
          })
        );
      return true;
    case "POSTONE_FILL_PEERLIST":
      fillPeerlist(message.payload)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({
            ok: false,
            message:
              error instanceof Error ? error.message : "작성창 채우기 실패",
          })
        );
      return true;
    default:
      return false;
  }
});
