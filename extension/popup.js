/**
 * PostOne Bridge — 팝업.
 *
 * 저장된 Peerlist / Reddit 초안을 보여주고(편집 가능), 각 사이트 작성창에 채우거나
 * 탭을 연다. 글자수 상한은 lib/ai/types.ts CHANNEL_LIMITS와 같은 값(제품 가드)이다.
 * 게시(Submit/Post)는 절대 대신 누르지 않는다.
 */
(() => {
  "use strict";

  const DRAFT_STORAGE_KEY = "peerlistDraft";
  const DRAFT_MAX = 700;
  const SAVE_DEBOUNCE_MS = 400;

  const REDDIT_DRAFT_STORAGE_KEY = "redditDraft";
  const REDDIT_TITLE_MAX = 300;
  const REDDIT_BODY_MAX = 40000;
  const REDDIT_SAVE_DEBOUNCE_MS = 400;

  const els = {
    draft: document.getElementById("draft"),
    count: document.getElementById("count"),
    updated: document.getElementById("updated"),
    status: document.getElementById("status"),
    fill: document.getElementById("fill"),
    open: document.getElementById("open"),
    state: document.getElementById("extension-state"),
    redditTitle: document.getElementById("reddit-title"),
    redditBody: document.getElementById("reddit-body"),
    redditCount: document.getElementById("reddit-count"),
    redditSub: document.getElementById("reddit-sub"),
    redditMeta: document.getElementById("reddit-meta"),
    redditStatus: document.getElementById("reddit-status"),
    redditFill: document.getElementById("reddit-fill"),
    redditOpen: document.getElementById("reddit-open"),
  };

  let updatedAt = "";
  let saveTimer = null;
  let redditUpdatedAt = "";
  let redditSaveTimer = null;
  let redditDraft = { subreddit: "", title: "", body: "" };

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

  function setStatus(el, text, tone) {
    el.textContent = text || "";
    if (tone) {
      el.dataset.tone = tone;
    } else {
      delete el.dataset.tone;
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

  function updateRedditCount() {
    const length = Array.from(els.redditBody.value).length;
    els.redditCount.textContent = `${length} / ${REDDIT_BODY_MAX}`;
    els.redditCount.classList.toggle("over", length > REDDIT_BODY_MAX);
    els.redditSub.textContent = redditDraft.subreddit
      ? `r/${redditDraft.subreddit}`
      : "서브레딧 미지정";
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

  // ─── Peerlist ─────────────────────────────────────────────────────────────

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

  // ─── Reddit ───────────────────────────────────────────────────────────────

  function renderRedditDraft(draft) {
    redditDraft = {
      subreddit: draft && typeof draft.subreddit === "string" ? draft.subreddit : "",
      title: draft && typeof draft.title === "string" ? draft.title : "",
      body: draft && typeof draft.body === "string" ? draft.body : "",
    };
    redditUpdatedAt =
      draft && typeof draft.updatedAt === "string" ? draft.updatedAt : "";
    els.redditTitle.value = redditDraft.title;
    els.redditBody.value = redditDraft.body;
    els.redditMeta.textContent = formatUpdated(redditUpdatedAt);
    updateRedditCount();
  }

  function readRedditForm() {
    return {
      subreddit: redditDraft.subreddit,
      title: els.redditTitle.value,
      body: els.redditBody.value,
    };
  }

  function saveRedditNow() {
    if (redditSaveTimer) {
      clearTimeout(redditSaveTimer);
      redditSaveTimer = null;
    }
    const form = readRedditForm();
    if (!form.title.trim() || !form.body.trim()) return Promise.resolve(null);
    redditUpdatedAt = new Date().toISOString();
    els.redditMeta.textContent = formatUpdated(redditUpdatedAt);
    return send({
      type: "POSTONE_SAVE_REDDIT_DRAFT",
      payload: { ...form, updatedAt: redditUpdatedAt },
    });
  }

  function scheduleRedditSave() {
    if (redditSaveTimer) clearTimeout(redditSaveTimer);
    redditSaveTimer = setTimeout(() => {
      redditSaveTimer = null;
      void saveRedditNow();
    }, REDDIT_SAVE_DEBOUNCE_MS);
  }

  // ─── 이벤트 ───────────────────────────────────────────────────────────────

  els.draft.addEventListener("input", () => {
    updateCount();
    scheduleSave();
    if (els.status.dataset.tone === "error") setStatus(els.status, "", null);
  });

  els.fill.addEventListener("click", async () => {
    const content = els.draft.value;
    if (!content.trim()) {
      setStatus(els.status, "초안 없음 — PostOne에서 먼저 전송", "error");
      return;
    }
    els.fill.disabled = true;
    setStatus(els.status, "작성창 채우는 중...", null);
    await saveNow();
    const response = await send({
      type: "POSTONE_FILL_PEERLIST",
      payload: { content },
    });
    els.fill.disabled = false;
    if (response && response.ok) {
      setStatus(
        els.status,
        response.message || "작성창에 채웠습니다 — Peerlist에서 확인 후 직접 게시",
        "success"
      );
    } else {
      setStatus(
        els.status,
        (response && response.message) ||
          "작성창 채우기 실패 — Peerlist 탭을 열고 다시 시도",
        "error"
      );
    }
  });

  els.open.addEventListener("click", async () => {
    const response = await send({ type: "POSTONE_OPEN_PEERLIST" });
    if (!response || !response.ok) {
      setStatus(els.status, "Peerlist 열기 실패", "error");
    }
  });

  els.redditTitle.addEventListener("input", () => {
    scheduleRedditSave();
    if (els.redditStatus.dataset.tone === "error") {
      setStatus(els.redditStatus, "", null);
    }
  });

  els.redditBody.addEventListener("input", () => {
    updateRedditCount();
    scheduleRedditSave();
    if (els.redditStatus.dataset.tone === "error") {
      setStatus(els.redditStatus, "", null);
    }
  });

  els.redditFill.addEventListener("click", async () => {
    const form = readRedditForm();
    if (!form.title.trim() || !form.body.trim()) {
      setStatus(els.redditStatus, "제목·본문 없음 — PostOne에서 먼저 전송", "error");
      return;
    }
    els.redditFill.disabled = true;
    setStatus(els.redditStatus, "작성창 채우는 중...", null);
    await saveRedditNow();
    const response = await send({
      type: "POSTONE_FILL_REDDIT",
      payload: form,
    });
    els.redditFill.disabled = false;
    if (response && response.ok) {
      setStatus(
        els.redditStatus,
        response.message || "작성창에 채웠습니다 — Reddit에서 확인 후 직접 게시",
        "success"
      );
    } else {
      setStatus(
        els.redditStatus,
        (response && response.message) ||
          "작성창 채우기 실패 — Reddit 글쓰기 창을 열고 다시 시도",
        "error"
      );
    }
  });

  els.redditOpen.addEventListener("click", async () => {
    const response = await send({
      type: "POSTONE_OPEN_REDDIT",
      payload: { subreddit: redditDraft.subreddit },
    });
    if (!response || !response.ok) {
      setStatus(els.redditStatus, "Reddit 열기 실패", "error");
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    if (changes[DRAFT_STORAGE_KEY]) {
      const next = changes[DRAFT_STORAGE_KEY].newValue;
      if (next && typeof next.content === "string") {
        if (document.activeElement === els.draft) {
          updatedAt = next.updatedAt || "";
          els.updated.textContent = formatUpdated(updatedAt);
        } else {
          renderDraft(next);
          setState("ready", "초안 있음");
          setStatus(els.status, "PostOne에서 새 초안 도착", "success");
        }
      }
    }

    if (changes[REDDIT_DRAFT_STORAGE_KEY]) {
      const next = changes[REDDIT_DRAFT_STORAGE_KEY].newValue;
      if (next && typeof next.title === "string") {
        if (
          document.activeElement === els.redditTitle ||
          document.activeElement === els.redditBody
        ) {
          redditUpdatedAt = next.updatedAt || "";
          els.redditMeta.textContent = formatUpdated(redditUpdatedAt);
        } else {
          renderRedditDraft(next);
          setState("ready", "초안 있음");
          setStatus(els.redditStatus, "PostOne에서 Reddit 초안 도착", "success");
        }
      }
    }
  });

  void (async () => {
    const response = await send({ type: "POSTONE_GET_DRAFT" });
    if (!response || !response.ok) {
      setState("missing", "연결 확인 실패");
    } else {
      renderDraft(response.draft);
    }

    const redditResponse = await send({ type: "POSTONE_GET_REDDIT_DRAFT" });
    if (redditResponse && redditResponse.ok) {
      renderRedditDraft(redditResponse.draft);
    }

    const hasAny =
      (response && response.ok && response.draft) ||
      (redditResponse && redditResponse.ok && redditResponse.draft);
    setState("ready", hasAny ? "초안 있음" : "초안 없음");
  })();
})();
