/**
 * Reddit(https://www.reddit.com) 글쓰기 창용 content script.
 *
 * popup/background가 보낸 Reddit 초안(제목·본문·서브레딧 힌트)을 현재 글쓰기
 * 페이지(submit)의 제목·본문 입력창에 채운다. React 계열 에디터가 상태를 갱신하도록
 * 네이티브 setter + input/change 이벤트를 사용하고, contenteditable은 execCommand
 * 삽입 후 DOM 교체로 폴백한다.
 *
 * 원칙: Post(게시) 버튼은 절대 자동 클릭하지 않는다. 작성창만 채워 사용자가 확인 후
 * 1클릭으로 게시한다. 네트워크 요청도 보내지 않는다.
 */
(() => {
  "use strict";

  const TITLE_SELECTORS = [
    'textarea[name="title"]',
    'input[name="title"]',
    'textarea[placeholder="Title"]',
    'textarea[placeholder*="title" i]',
    '[aria-label="Title"]',
    '[aria-label="제목"]',
    "faceplate-textarea-input textarea",
  ];

  const BODY_SELECTORS = [
    'div[contenteditable="true"][role="textbox"]',
    '[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"]',
    "shreddit-composer div[contenteditable]",
    'textarea[name="text"]',
    'textarea[placeholder*="body" i]',
    'textarea[placeholder*="text" i]',
    "textarea",
  ];

  const SUBREDDIT_SELECTORS = [
    'input[name="subreddit"]',
    'input[placeholder*="community" i]',
    'input[placeholder*="subreddit" i]',
    '[aria-label*="community" i]',
    "#subreddit",
  ];

  const SKIP_HINT =
    /(search|comment|reply|message|검색|댓글|답글|쪽지|url|link|profile)/i;
  const TITLE_HINT = /(title|제목)/i;

  const FILL_WAIT_MS = 3000;

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
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio") return false;
      return !el.disabled && !el.readOnly;
    }
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
      el.getAttribute("name"),
    ]
      .filter(Boolean)
      .join(" ");
  }

  function isUsable(el, selectors) {
    if (!(el instanceof HTMLElement)) return false;
    if (selectors && !selectors.some((selector) => el.matches(selector))) {
      return false;
    }
    if (el.closest('[aria-hidden="true"]')) return false;
    return isEditable(el) && isVisible(el);
  }

  function findTitle() {
    for (const selector of TITLE_SELECTORS) {
      for (const el of Array.from(document.querySelectorAll(selector))) {
        if (isUsable(el) && !SKIP_HINT.test(hintText(el))) return el;
      }
    }
    return null;
  }

  /**
   * 본문 편집창 — Reddit 본문은 리치 에디터(contenteditable)다. 제목란을 제외하고
   * 크기·contenteditable·role=textbox 가중치로 가장 그럴듯한 편집창을 고른다.
   */
  function findBody(titleEl) {
    let best = null;
    let bestScore = 0;
    const seen = new Set();

    for (const selector of BODY_SELECTORS) {
      for (const el of Array.from(document.querySelectorAll(selector))) {
        if (!(el instanceof HTMLElement) || seen.has(el)) continue;
        seen.add(el);
        if (el === titleEl) continue;
        if (el.matches('textarea[name="title"], input[name="title"]')) continue;
        if (!isUsable(el)) continue;

        const hints = hintText(el);
        if (TITLE_HINT.test(hints) && !el.isContentEditable) continue;
        if (SKIP_HINT.test(hints)) continue;

        const rect = el.getBoundingClientRect();
        let score =
          Math.min(rect.width, 720) / 100 + Math.min(rect.height, 400) / 100;
        if (el.isContentEditable) score += 3;
        if (el.getAttribute("role") === "textbox") score += 2;
        if (rect.height >= 80) score += 1.5;
        if (el.closest("form")) score += 0.5;

        if (score > bestScore) {
          best = el;
          bestScore = score;
        }
      }
    }

    return best;
  }

  function findSubredditInput() {
    for (const selector of SUBREDDIT_SELECTORS) {
      for (const el of Array.from(document.querySelectorAll(selector))) {
        if (isUsable(el)) return el;
      }
    }
    return null;
  }

  function waitFor(find, timeoutMs) {
    const found = find();
    if (found) return Promise.resolve(found);
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        const el = find();
        if (el || Date.now() - startedAt >= timeoutMs) {
          window.clearInterval(timer);
          resolve(el);
        }
      }, 200);
    });
  }

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
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (!descriptor || !descriptor.set) {
      el.value = content;
    } else {
      descriptor.set.call(el, content);
    }
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

  /** contenteditable / 리치 에디터 */
  function fillEditable(el, content) {
    el.focus();
    selectContents(el);

    let inserted = false;
    try {
      inserted =
        typeof document.execCommand === "function" &&
        document.execCommand("insertText", false, content);
    } catch {
      inserted = false;
    }

    const text = normalize(el.innerText || el.textContent);
    if (inserted && verifyFilled(text, content)) return true;

    replaceEditableDom(el, content);
    dispatchInput(el, content);
    return verifyFilled(el.innerText || el.textContent, content);
  }

  function fillField(el, content) {
    return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
      ? fillTextControl(el, content)
      : fillEditable(el, content);
  }

  function normalizeSubreddit(input) {
    return String(input || "")
      .trim()
      .replace(/^\/?r\//i, "")
      .trim();
  }

  /** /submit(커뮤니티 선택 필요)인지 — r/<sub>/submit 이면 서브레딧이 이미 정해져 있다. */
  function needsSubreddit() {
    return /^\/submit\/?$/.test(window.location.pathname);
  }

  async function handleFill(draft) {
    if (!draft || typeof draft !== "object") {
      return { ok: false, message: "Reddit 초안이 비어 있습니다." };
    }
    const title = typeof draft.title === "string" ? draft.title.trim() : "";
    const body = typeof draft.body === "string" ? draft.body : "";
    const subreddit = normalizeSubreddit(draft.subreddit);

    if (!title) {
      return { ok: false, message: "Reddit 제목이 비어 있습니다." };
    }
    if (!body.trim()) {
      return { ok: false, message: "Reddit 본문이 비어 있습니다." };
    }

    const titleEl = await waitFor(findTitle, FILL_WAIT_MS);
    if (!titleEl) {
      return {
        ok: false,
        message:
          "Reddit 제목 입력창을 찾지 못했습니다. 글쓰기(submit) 창을 연 뒤 다시 시도해 주세요.",
      };
    }

    const bodyEl = await waitFor(() => findBody(findTitle()), FILL_WAIT_MS);
    if (!bodyEl) {
      return {
        ok: false,
        message:
          "본문 편집창을 찾지 못했습니다. 'Text' 탭을 선택한 뒤 다시 시도해 주세요.",
      };
    }

    const titleFilled = fillField(titleEl, title);
    const bodyFilled = fillField(bodyEl, body);

    if (!titleFilled && !bodyFilled) {
      return {
        ok: false,
        message:
          "작성창에 글을 채우지 못했습니다. 초안을 복사해 직접 붙여넣어 주세요.",
      };
    }

    // /submit 에서는 서브레딧을 직접 골라야 한다 — 힌트가 있으면 최선껏 채운다.
    let subredditFilled = null;
    if (needsSubreddit() && subreddit) {
      const input = findSubredditInput();
      subredditFilled = input ? fillTextControl(input, subreddit) : false;
    }

    titleEl.scrollIntoView({ block: "center", behavior: "smooth" });

    const subredditNote =
      needsSubreddit() && subreddit && subredditFilled !== true
        ? " 서브레딧을 직접 선택한 뒤 게시해 주세요."
        : " 내용 확인 후 직접 게시해 주세요.";

    return {
      ok: true,
      filled: { title: titleFilled, body: bodyFilled, subreddit: subredditFilled },
      message: `Reddit 제목·본문을 채웠습니다.${subredditNote}`,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;

    if (message.type === "POSTONE_REDDIT_STATUS") {
      sendResponse({
        ok: true,
        ready: Boolean(findTitle()) && Boolean(findBody(findTitle())),
      });
      return false;
    }

    if (message.type === "POSTONE_REDDIT_FILL") {
      handleFill(message.draft)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : "Reddit 작성창 채우기 중 오류가 발생했습니다.",
          });
        });
      return true;
    }

    return false;
  });
})();
