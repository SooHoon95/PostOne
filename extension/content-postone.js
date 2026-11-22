/**
 * PostOne 웹 페이지용 content script.
 *
 * - 로드되면 POSTONE_EXTENSION_READY를 알려 웹 UI가 "확장 연결됨"을 표시하게 한다.
 * - 웹이 보낸 POSTONE_PEERLIST_DRAFT를 background로 넘겨 chrome.storage.local에
 *   { content, updatedAt } 형태로 저장하고, 결과를 POSTONE_EXTENSION_ACK로 회신한다.
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
    ack: "POSTONE_EXTENSION_ACK",
  };
  const DRAFT_STORAGE_KEY = "peerlistDraft";
  const MAX_CONTENT_LENGTH = 20000;

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
  function saveDraft(draft) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "POSTONE_SAVE_DRAFT", payload: draft },
          (response) => {
            if (chrome.runtime.lastError) {
              writeDraftDirect(draft).then(resolve);
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
          }
        );
      } catch {
        writeDraftDirect(draft).then(resolve);
      }
    });
  }

  function writeDraftDirect(draft) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: draft }, () => {
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

    const result = await saveDraft({ content, updatedAt });
    if (result.ok) {
      replyAck({ ok: true, content, updatedAt });
    } else {
      replyAck({ ok: false, message: result.message });
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
    }
  });

  // 웹이 이미 열려 있던 경우에도 바로 감지되도록 로드 시 알린다.
  announceReady();
})();
