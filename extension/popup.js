/**
 * PostOne Peerlist Bridge — 팝업.
 *
 * 저장된 Peerlist 초안을 보여주고(편집 가능), Peerlist 작성창에 채우거나
 * Peerlist 탭을 연다. 글자수 상한 700은 lib/ai/types.ts CHANNEL_LIMITS.peerlist.content와
 * 같은 값(제품 가드)이다. 게시(Submit)는 절대 대신 누르지 않는다.
 */
(() => {
  "use strict";

  const DRAFT_STORAGE_KEY = "peerlistDraft";
  const DRAFT_MAX = 700;
  const SAVE_DEBOUNCE_MS = 400;

  const els = {
    draft: document.getElementById("draft"),
    count: document.getElementById("count"),
    updated: document.getElementById("updated"),
    status: document.getElementById("status"),
    fill: document.getElementById("fill"),
    open: document.getElementById("open"),
    state: document.getElementById("extension-state"),
  };

  let updatedAt = "";
  let saveTimer = null;

  function send(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response || null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function setStatus(text, tone) {
    els.status.textContent = text || "";
    if (tone) {
      els.status.dataset.tone = tone;
    } else {
      delete els.status.dataset.tone;
    }
  }

  function setState(state, label) {
    els.state.dataset.state = state;
    els.state.textContent = label;
  }

  function updateCount() {
    const length = Array.from(els.draft.value).length;
    els.count.textContent = `${length} / ${DRAFT_MAX}`;
    els.count.classList.toggle("over", length > DRAFT_MAX);
  }

  function formatUpdated(value) {
    if (!value) return "최근 수신 없음";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "최근 수신 없음";
    return `최근 수신 ${date.toLocaleString("ko-KR", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  function renderDraft(draft) {
    const content = draft && typeof draft.content === "string" ? draft.content : "";
    updatedAt = draft && typeof draft.updatedAt === "string" ? draft.updatedAt : "";
    els.draft.value = content;
    els.updated.textContent = formatUpdated(updatedAt);
    updateCount();
  }

  function saveNow() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const content = els.draft.value;
    if (!content.trim()) return Promise.resolve(null);
    updatedAt = new Date().toISOString();
    els.updated.textContent = formatUpdated(updatedAt);
    return send({
      type: "POSTONE_SAVE_DRAFT",
      payload: { content, updatedAt },
    });
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void saveNow();
    }, SAVE_DEBOUNCE_MS);
  }

  els.draft.addEventListener("input", () => {
    updateCount();
    scheduleSave();
    if (els.status.dataset.tone === "error") setStatus("", null);
  });

  els.fill.addEventListener("click", async () => {
    const content = els.draft.value;
    if (!content.trim()) {
      setStatus("초안 없음 — PostOne에서 먼저 전송", "error");
      return;
    }
    els.fill.disabled = true;
    setStatus("작성창 채우는 중...", null);
    await saveNow();
    const response = await send({
      type: "POSTONE_FILL_PEERLIST",
      payload: { content },
    });
    els.fill.disabled = false;
    if (response && response.ok) {
      setStatus(
        response.message || "작성창에 채웠습니다 — Peerlist에서 확인 후 직접 게시",
        "success"
      );
    } else {
      setStatus(
        (response && response.message) ||
          "작성창 채우기 실패 — Peerlist 탭을 열고 다시 시도",
        "error"
      );
    }
  });

  els.open.addEventListener("click", async () => {
    const response = await send({ type: "POSTONE_OPEN_PEERLIST" });
    if (!response || !response.ok) {
      setStatus("Peerlist 열기 실패", "error");
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[DRAFT_STORAGE_KEY]) return;
    const next = changes[DRAFT_STORAGE_KEY].newValue;
    if (!next || typeof next.content !== "string") return;
    if (document.activeElement === els.draft) {
      updatedAt = next.updatedAt || "";
      els.updated.textContent = formatUpdated(updatedAt);
      return;
    }
    renderDraft(next);
    setState("ready", "초안 있음");
    setStatus("PostOne에서 새 초안 도착", "success");
  });

  void (async () => {
    const response = await send({ type: "POSTONE_GET_DRAFT" });
    if (!response || !response.ok) {
      setState("missing", "연결 확인 실패");
      return;
    }
    renderDraft(response.draft);
    setState(
      response.draft ? "ready" : "unknown",
      response.draft ? "초안 있음" : "초안 없음"
    );
  })();
})();
