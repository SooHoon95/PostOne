/**
 * Peerlist(https://peerlist.io)용 content script.
 *
 * popup/background가 보낸 초안을 현재 페이지의 글쓰기 작성창(Scroll/Post composer)에
 * 채운다. React·ProseMirror/TipTap가 상태를 갱신하도록 네이티브 setter + input/change
 * 이벤트를 사용하고, contenteditable은 execCommand 삽입 후 DOM 교체로 폴백한다.
 *
 * 원칙: Submit/Post 버튼은 절대 자동 클릭하지 않는다. 작성창만 채워 사용자가 확인 후
 * 1클릭으로 게시한다.
 */
(() => {
  "use strict";

  const COMPOSER_SELECTOR = [
    "textarea",
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[role="textbox"]',
    ".ProseMirror",
    ".tiptap",
  ].join(",");

  const COMPOSER_HINT =
    /(post|share|write|what|thought|building|working|update|compose|story|글|작성)/i;
  const SKIP_HINT = /(search|comment|reply|message|검색|댓글|답글|쪽지)/i;

  function normalize(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 12) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    if (style.opacity && Number(style.opacity) === 0) return false;
    return true;
  }

  function isEditable(el) {
    if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
    if (el instanceof HTMLInputElement) return !el.disabled && !el.readOnly;
    if (el.isContentEditable) return true;
    const attr = el.getAttribute("contenteditable");
    return attr === "true" || attr === "";
  }

  function hintText(el) {
    return [
      el.getAttribute("placeholder"),
      el.getAttribute("data-placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("aria-placeholder"),
    ]
      .filter(Boolean)
      .join(" ");
  }

  /**
   * 가장 그럴듯한 작성창을 고른다. Peerlist 댓글·검색창보다 큰 본문 작성창을
   * 우선하고, placeholder 힌트에 가중치를 준다.
   */
  function findComposer() {
    const nodes = Array.from(document.querySelectorAll(COMPOSER_SELECTOR));
    let best = null;
    let bestScore = 0;

    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      if (!isEditable(el)) continue;
      if (!isVisible(el)) continue;

      const hints = hintText(el);
      if (SKIP_HINT.test(hints)) continue;

      const rect = el.getBoundingClientRect();
      let score = Math.min(rect.width, 640) / 100 + Math.min(rect.height, 320) / 100;
      if (COMPOSER_HINT.test(hints)) score += 6;
      if (el.tagName === "TEXTAREA") score += 1.5;
      if (el.isContentEditable) score += 1.5;
      if (el.closest("form")) score += 0.5;

      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return best;
  }

  function waitForComposer(timeoutMs) {
    const found = findComposer();
    if (found) return Promise.resolve(found);
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        const el = findComposer();
        if (el || Date.now() - startedAt >= timeoutMs) {
          window.clearInterval(timer);
          resolve(el);
        }
      }, 200);
    });
  }

  /**
   * 삽입 후 검증 — 편집기가 줄바꿈을 블록으로 바꾸므로 첫 줄만 느슨하게 확인한다.
   */
  function verifyFilled(text, content) {
    const firstLine = normalize(String(content).split(/\n/)[0]).slice(0, 24);
    return Boolean(firstLine) && normalize(text).includes(firstLine);
  }

  function dispatchInput(el, content) {
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: false,
        inputType: "insertText",
        data: content,
      })
    );
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** textarea/input: React가 감지하는 네이티브 setter 경로 사용 */
  function fillTextControl(el, content) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, content);
    dispatchInput(el, content);
    return verifyFilled(el.value, content);
  }

  function selectContents(el) {
    const selection = window.getSelection();
    if (!selection) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function replaceEditableDom(el, content) {
    el.innerHTML = "";
    const blocks = content.split(/\n{2,}/);
    for (const block of blocks) {
      const paragraph = document.createElement("p");
      const lines = block.split(/\n/);
      lines.forEach((line, index) => {
        if (index > 0) paragraph.appendChild(document.createElement("br"));
        paragraph.appendChild(document.createTextNode(line));
      });
      el.appendChild(paragraph);
    }
  }

  /** contenteditable / ProseMirror / TipTap */
  function fillEditable(el, content) {
    el.focus();
    selectContents(el);

    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, content);
    } catch {
      inserted = false;
    }

    const text = normalize(el.innerText || el.textContent);
    const ok = inserted && verifyFilled(text, content);
    if (ok) return true;

    replaceEditableDom(el, content);
    dispatchInput(el, content);
    return verifyFilled(el.innerText || el.textContent, content);
  }

  async function handleFill(content) {
    if (typeof content !== "string" || !content.trim()) {
      return { ok: false, message: "초안이 비어 있습니다." };
    }

    const el = await waitForComposer(2000);
    if (!el) {
      return {
        ok: false,
        message:
          "Peerlist 작성창을 찾지 못했습니다. 글쓰기 창을 열고 다시 시도해 주세요.",
      };
    }

    const filled =
      el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
        ? fillTextControl(el, content)
        : fillEditable(el, content);

    if (!filled) {
      return {
        ok: false,
        message: "작성창에 글을 채우지 못했습니다. 초안을 복사해 직접 붙여넣어 주세요.",
      };
    }

    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return {
      ok: true,
      message: "작성창에 채웠습니다. 내용 확인 후 직접 게시해 주세요.",
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;

    if (message.type === "POSTONE_PEERLIST_STATUS") {
      sendResponse({ ok: true, composer: Boolean(findComposer()) });
      return false;
    }

    if (message.type === "POSTONE_PEERLIST_FILL") {
      handleFill(message.content)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : "작성창 채우기 중 오류가 발생했습니다.",
          });
        });
      return true;
    }

    return false;
  });
})();
