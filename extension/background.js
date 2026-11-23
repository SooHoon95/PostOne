/**
 * PostOne Bridge — background service worker.
 *
 * 책임:
 * - 초안 저장/조회의 단일 창구(chrome.storage.local)
 *     · Peerlist: 키 `peerlistDraft` = { content, updatedAt }
 *     · Reddit:   키 `redditDraft`   = { subreddit, title, body, updatedAt }
 * - PostOne content script의 저장 요청 중계
 * - 팝업의 "열기" 탭 열기/포커스, "작성창에 채우기"를 각 탭 content script로 전달
 * - 배지 피드백
 *
 * 게시(Submit/Post)는 절대 대신 누르지 않는다 — 자동 클릭 코드 없음.
 */
const DRAFT_STORAGE_KEY = "peerlistDraft";
const PEERLIST_HOME_URL = "https://peerlist.io/";
const PEERLIST_URL_PATTERN = "https://peerlist.io/*";
const MAX_CONTENT_LENGTH = 20000;

const REDDIT_DRAFT_STORAGE_KEY = "redditDraft";
const REDDIT_ORIGIN = "https://www.reddit.com";
const REDDIT_SUBMIT_URL = "https://www.reddit.com/submit";
const REDDIT_SUBMIT_URL_PATTERNS = [
  "https://www.reddit.com/submit*",
  "https://www.reddit.com/r/*/submit*",
];
const REDDIT_TITLE_MAX = 300;
const REDDIT_BODY_MAX = 40000;
const SUBREDDIT_RE = /^[A-Za-z0-9_]{2,21}$/;

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

// ─── Reddit 초안 ────────────────────────────────────────────────────────────

function normalizeSubreddit(input) {
  return String(input || "")
    .trim()
    .replace(/^\/?r\//i, "")
    .trim();
}

function redditSubmitUrl(subreddit) {
  const sub = normalizeSubreddit(subreddit);
  if (sub && SUBREDDIT_RE.test(sub)) {
    return `${REDDIT_ORIGIN}/r/${sub}/submit`;
  }
  return REDDIT_SUBMIT_URL;
}

function isRedditDraft(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.subreddit === "string" &&
    typeof value.title === "string" &&
    typeof value.body === "string" &&
    typeof value.updatedAt === "string"
  );
}

function getRedditDraft() {
  return new Promise((resolve) => {
    chrome.storage.local.get(REDDIT_DRAFT_STORAGE_KEY, (result) => {
      const draft = result && result[REDDIT_DRAFT_STORAGE_KEY];
      resolve(isRedditDraft(draft) ? draft : null);
    });
  });
}

function saveRedditDraft(payload) {
  const title = payload && typeof payload.title === "string" ? payload.title : "";
  const body = payload && typeof payload.body === "string" ? payload.body : "";
  const subreddit = normalizeSubreddit(
    payload && typeof payload.subreddit === "string" ? payload.subreddit : ""
  );

  if (!title.trim()) {
    return Promise.resolve({ ok: false, message: "Reddit 제목이 비어 있습니다." });
  }
  if (title.trim().length > REDDIT_TITLE_MAX) {
    return Promise.resolve({
      ok: false,
      message: `Reddit 제목은 최대 ${REDDIT_TITLE_MAX}자입니다.`,
    });
  }
  if (!body.trim()) {
    return Promise.resolve({ ok: false, message: "Reddit 본문이 비어 있습니다." });
  }
  if (body.length > REDDIT_BODY_MAX) {
    return Promise.resolve({
      ok: false,
      message: `Reddit 본문은 최대 ${REDDIT_BODY_MAX}자입니다.`,
    });
  }
  if (subreddit && !SUBREDDIT_RE.test(subreddit)) {
    return Promise.resolve({
      ok: false,
      message: "서브레딧 이름이 올바르지 않습니다 (영문·숫자·밑줄 2~21자).",
    });
  }

  const draft = {
    subreddit,
    title: title.trim(),
    body,
    updatedAt:
      payload && typeof payload.updatedAt === "string" && payload.updatedAt
        ? payload.updatedAt
        : new Date().toISOString(),
  };

  return new Promise((resolve) => {
    chrome.storage.local.set({ [REDDIT_DRAFT_STORAGE_KEY]: draft }, () => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          message: chrome.runtime.lastError.message || "Reddit 초안 저장 실패",
        });
        return;
      }
      resolve({ ok: true, draft });
    });
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

async function focusTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  if (typeof tab.windowId === "number") {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
}

async function openPeerlist() {
  const tabs = await chrome.tabs.query({ url: PEERLIST_URL_PATTERN });
  if (tabs.length > 0) {
    await focusTab(tabs[0]);
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
  await focusTab(tab);

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

async function openReddit(payload) {
  const subreddit =
    payload && typeof payload.subreddit === "string" ? payload.subreddit : "";
  const url = redditSubmitUrl(subreddit);

  const tabs = await chrome.tabs.query({ url: REDDIT_SUBMIT_URL_PATTERNS });
  if (tabs.length > 0) {
    await focusTab(tabs[0]);
    return { ok: true, opened: "existing", url };
  }
  await chrome.tabs.create({ url });
  return { ok: true, opened: "new", url };
}

async function fillReddit(payload) {
  const title = payload && typeof payload.title === "string" ? payload.title : "";
  const body = payload && typeof payload.body === "string" ? payload.body : "";
  const subreddit = normalizeSubreddit(
    payload && typeof payload.subreddit === "string" ? payload.subreddit : ""
  );

  if (!title.trim()) {
    return { ok: false, message: "Reddit 제목이 비어 있습니다." };
  }
  if (!body.trim()) {
    return { ok: false, message: "Reddit 본문이 비어 있습니다." };
  }

  const tabs = await chrome.tabs.query({ url: REDDIT_SUBMIT_URL_PATTERNS });
  if (tabs.length === 0) {
    return {
      ok: false,
      reason: "no-reddit-tab",
      message: "Reddit 글쓰기 창(submit)을 먼저 열어 주세요.",
    };
  }

  const tab = tabs[0];
  await focusTab(tab);

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "POSTONE_REDDIT_FILL",
      draft: { subreddit, title: title.trim(), body },
    });
    const ok = Boolean(response && response.ok);
    await flashBadge(ok ? "✓" : "!", ok ? "#16a34a" : "#dc2626");
    return response || {
      ok: false,
      message: "Reddit 응답이 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    };
  } catch {
    await flashBadge("!", "#dc2626");
    return {
      ok: false,
      reason: "no-content-script",
      message: "Reddit 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DRAFT_STORAGE_KEY, () => {});
  chrome.storage.local.get(REDDIT_DRAFT_STORAGE_KEY, () => {});
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
    case "POSTONE_GET_REDDIT_DRAFT":
      getRedditDraft().then((draft) => sendResponse({ ok: true, draft }));
      return true;
    case "POSTONE_SAVE_REDDIT_DRAFT":
      saveRedditDraft(message.payload).then(sendResponse);
      return true;
    case "POSTONE_OPEN_REDDIT":
      openReddit(message.payload)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({
            ok: false,
            message: error instanceof Error ? error.message : "Reddit 열기 실패",
          })
        );
      return true;
    case "POSTONE_FILL_REDDIT":
      fillReddit(message.payload)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({
            ok: false,
            message:
              error instanceof Error ? error.message : "Reddit 채우기 실패",
          })
        );
      return true;
    default:
      return false;
  }
});
