/**
 * PostOne 웹 페이지용 content script.
 *
 * - 로드되면 POSTONE_EXTENSION_READY를 알려 웹 UI가 "확장 연결됨"을 표시하게 한다.
 * - 웹이 보낸 초안을 background로 넘겨 chrome.storage.local에 저장하고,
 *   결과를 POSTONE_EXTENSION_ACK로 회신한다.
 *     · POSTONE_PEERLIST_DRAFT → { content, updatedAt }
 *     · POSTONE_REDDIT_DRAFT   → { subreddit, title, body, updatedAt }
 *
 * 메시지 타입 문자열은 lib/extension/peerlist-bridge.ts와 같은 값이다.
 */
(() => {
  "use strict";

  const WEB_SOURCE = "postone-web";
  const EXTENSION_SOURCE = "postone-extension";
  const MESSAGE = {
    ready: "POSTONE_EXTENSION_READY",
    ping: "POSTONE_EXTENSION_PING",
    draft: "POSTONE_PEERLIST_DRAFT",
    redditDraft: "POSTONE_REDDIT_DRAFT",
    ack: "POSTONE_EXTENSION_ACK",
  };
  const DRAFT_STORAGE_KEY = "peerlistDraft";
  const MAX_CONTENT_LENGTH = 20000;

  const REDDIT_DRAFT_STORAGE_KEY = "redditDraft";
  const REDDIT_TITLE_MAX = 300;
  const REDDIT_BODY_MAX = 40000;
  const SUBREDDIT_RE = /^[A-Za-z0-9_]{2,21}$/;

  function postToPage(data) {
    window.postMessage(data, window.location.origin);
  }

  function announceReady() {
    postToPage({
      source: EXTENSION_SOURCE,
      type: MESSAGE.ready,
      payload: { version: chrome.runtime.getManifest().version },
    });
  }

  function replyAck(payload) {
    postToPage({ source: EXTENSION_SOURCE, type: MESSAGE.ack, payload });
  }

  /** background에 저장을 맡긴다(단일 저장소 책임). 실패하면 직접 저장으로 폴백. */
  function saveViaBackground(type, payload, storageKey) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
          if (chrome.runtime.lastError) {
            writeDirect(storageKey, payload).then(resolve);
            return;
          }
          if (response && response.ok) {
            resolve({ ok: true });
          } else {
            resolve({
              ok: false,
              message: (response && response.message) || "초안 저장 실패",
            });
          }
        });
      } catch {
        writeDirect(storageKey, payload).then(resolve);
      }
    });
  }

  function writeDirect(storageKey, value) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [storageKey]: value }, () => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              message: chrome.runtime.lastError.message || "초안 저장 실패",
            });
            return;
          }
          resolve({ ok: true });
        });
      } catch (error) {
        resolve({
          ok: false,
          message: error instanceof Error ? error.message : "초안 저장 실패",
        });
      }
    });
  }

  async function handleDraftMessage(payload) {
    const content =
      payload && typeof payload.content === "string" ? payload.content : "";
    if (!content.trim()) {
      replyAck({ ok: false, message: "초안 본문이 비어 있습니다." });
      return;
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      replyAck({ ok: false, message: "초안이 너무 깁니다." });
      return;
    }
    const updatedAt =
      payload && typeof payload.updatedAt === "string" && payload.updatedAt
        ? payload.updatedAt
        : new Date().toISOString();

    const draft = { content, updatedAt };
    const result = await saveViaBackground(
      "POSTONE_SAVE_DRAFT",
      draft,
      DRAFT_STORAGE_KEY
    );
    if (result.ok) {
      replyAck({ ok: true, content, updatedAt });
    } else {
      replyAck({ ok: false, message: result.message });
    }
  }

  async function handleRedditDraftMessage(payload) {
    const title = payload && typeof payload.title === "string" ? payload.title.trim() : "";
    const body = payload && typeof payload.body === "string" ? payload.body : "";
    const subreddit =
      payload && typeof payload.subreddit === "string"
        ? payload.subreddit.trim().replace(/^\/?r\//i, "").trim()
        : "";

    if (!title) {
      replyAck({ ok: false, channel: "reddit", message: "Reddit 제목이 비어 있습니다." });
      return;
    }
    if (title.length > REDDIT_TITLE_MAX) {
      replyAck({
        ok: false,
        channel: "reddit",
        message: `Reddit 제목은 최대 ${REDDIT_TITLE_MAX}자입니다.`,
      });
      return;
    }
    if (!body.trim()) {
      replyAck({ ok: false, channel: "reddit", message: "Reddit 본문이 비어 있습니다." });
      return;
    }
    if (body.length > REDDIT_BODY_MAX) {
      replyAck({
        ok: false,
        channel: "reddit",
        message: `Reddit 본문은 최대 ${REDDIT_BODY_MAX}자입니다.`,
      });
      return;
    }
    if (subreddit && !SUBREDDIT_RE.test(subreddit)) {
      replyAck({
        ok: false,
        channel: "reddit",
        message: "서브레딧 이름이 올바르지 않습니다 (영문·숫자·밑줄 2~21자).",
      });
      return;
    }

    const updatedAt =
      payload && typeof payload.updatedAt === "string" && payload.updatedAt
        ? payload.updatedAt
        : new Date().toISOString();

    const draft = { subreddit, title, body, updatedAt };
    const result = await saveViaBackground(
      "POSTONE_SAVE_REDDIT_DRAFT",
      draft,
      REDDIT_DRAFT_STORAGE_KEY
    );
    if (result.ok) {
      replyAck({ ok: true, channel: "reddit", title, updatedAt });
    } else {
      replyAck({ ok: false, channel: "reddit", message: result.message });
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (!data || typeof data !== "object" || data.source !== WEB_SOURCE) return;

    if (data.type === MESSAGE.ping) {
      announceReady();
      return;
    }
    if (data.type === MESSAGE.draft) {
      void handleDraftMessage(data.payload);
      return;
    }
    if (data.type === MESSAGE.redditDraft) {
      void handleRedditDraftMessage(data.payload);
    }
  });

  // 웹이 이미 열려 있던 경우에도 바로 감지되도록 로드 시 알린다.
  announceReady();
})();
