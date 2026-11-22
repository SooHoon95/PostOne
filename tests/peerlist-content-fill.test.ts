import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from "vitest";

/**
 * 실제 익스텐션 content script(extension/content-peerlist.js)를 jsdom에서 실행해,
 * Peerlist 작성창 채우기 경로(textarea / contenteditable)와 "찾지 못함" 응답을 검증한다.
 */
const SOURCE = readFileSync(
  path.resolve(__dirname, "../extension/content-peerlist.js"),
  "utf8"
);

type Listener = (
  message: { type?: string; content?: string },
  sender: unknown,
  sendResponse: (response: { ok: boolean; message?: string }) => void
) => boolean | undefined;

let listener: Listener;

// jsdom은 레이아웃이 없어 getBoundingClientRect가 0 — 화면에 보이는 것처럼 흉내낸다.
const rect = {
  width: 560,
  height: 180,
  top: 100,
  left: 100,
  right: 660,
  bottom: 280,
  x: 100,
  y: 100,
  toJSON: () => ({}),
};

beforeAll(() => {
  // jsdom은 레이아웃이 없어 getBoundingClientRect·scrollIntoView가 비어 있다.
  HTMLElement.prototype.getBoundingClientRect = () => rect as DOMRect;
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: {
        addListener: (fn: Listener) => {
          listener = fn;
        },
      },
    },
  });
  new Function(SOURCE)();
});

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

function sendFill(content: string) {
  const sendResponse = vi.fn();
  const keepChannelOpen = listener(
    { type: "POSTONE_PEERLIST_FILL", content },
    {},
    sendResponse
  );
  return { sendResponse, keepChannelOpen };
}

describe("content-peerlist composer fill", () => {
  it("fills a textarea composer and fires input/change events", async () => {
    document.body.innerHTML = `
      <form>
        <textarea placeholder="What are you building?" style="opacity: 1"></textarea>
      </form>`;
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    const onInput = vi.fn();
    const onChange = vi.fn();
    textarea.addEventListener("input", onInput);
    textarea.addEventListener("change", onChange);
    textarea.focus = () => {};

    const { sendResponse, keepChannelOpen } = sendFill("Peerlist 초안 본문");
    expect(keepChannelOpen).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse.mock.calls[0][0]).toMatchObject({ ok: true });
    expect(textarea.value).toBe("Peerlist 초안 본문");
    expect(onInput).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();
  });

  it("prefers the post composer over a comment box", async () => {
    document.body.innerHTML = `
      <div>
        <textarea placeholder="Write a comment..." style="opacity: 1"></textarea>
        <textarea placeholder="Share your thoughts" style="opacity: 1"></textarea>
      </div>`;
    const [comment, post] = Array.from(
      document.querySelectorAll("textarea")
    ) as HTMLTextAreaElement[];
    comment.focus = () => {};
    post.focus = () => {};

    const { sendResponse } = sendFill("본문 작성창만 채우기");
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse.mock.calls[0][0]).toMatchObject({ ok: true });
    expect(post.value).toBe("본문 작성창만 채우기");
    expect(comment.value).toBe("");
  });

  it("fills a contenteditable (ProseMirror-style) composer", async () => {
    document.body.innerHTML = `
      <div contenteditable="true" data-placeholder="What's on your mind?" style="opacity: 1"></div>`;
    const editor = document.querySelector(
      '[contenteditable="true"]'
    ) as HTMLElement;
    const onInput = vi.fn();
    editor.addEventListener("input", onInput);

    const { sendResponse } = sendFill("첫 문단\n\n둘째 문단");
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse.mock.calls[0][0]).toMatchObject({ ok: true });
    expect(editor.textContent).toContain("첫 문단");
    expect(editor.textContent).toContain("둘째 문단");
    expect(onInput).toHaveBeenCalled();
  });

  it("reports a clear message when no composer exists", async () => {
    document.body.innerHTML = "<p>피드만 있는 화면</p>";

    const { sendResponse } = sendFill("본문");
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), {
      timeout: 4000,
    });

    expect(sendResponse.mock.calls[0][0]).toMatchObject({ ok: false });
    expect(sendResponse.mock.calls[0][0].message).toContain("작성창을 찾지 못했습니다");
  });

  it("refuses to fill an empty draft", async () => {
    document.body.innerHTML = `<textarea placeholder="What are you building?"></textarea>`;

    const { sendResponse } = sendFill("   ");
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(sendResponse.mock.calls[0][0]).toMatchObject({ ok: false });
  });
});
