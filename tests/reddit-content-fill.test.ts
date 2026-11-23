import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from "vitest";

/**
 * 실제 익스텐션 content script(extension/content-reddit.js)를 jsdom에서 실행해,
 * Reddit 글쓰기 창(제목 textarea + 본문 contenteditable + 서브레딧 입력) 채우기와
 * "찾지 못함" 응답을 검증한다.
 */
const SOURCE = readFileSync(
  path.resolve(__dirname, "../extension/content-reddit.js"),
  "utf8"
);

type Listener = (
  message: { type?: string; draft?: { subreddit?: string; title?: string; body?: string } },
  sender: unknown,
  sendResponse: (response: {
    ok: boolean;
    message?: string;
    filled?: { title: boolean; body: boolean; subreddit: boolean | null };
  }) => void
) => boolean | undefined;

let listener: Listener;

const rect = (width: number, height: number) => ({
  width,
  height,
  top: 100,
  left: 100,
  right: 100 + width,
  bottom: 100 + height,
  x: 100,
  y: 100,
  toJSON: () => ({}),
});

beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = () => rect(700, 180) as DOMRect;
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
  window.history.replaceState({}, "", "/r/iosdev/submit");
});

afterEach(() => {
  document.body.innerHTML = "";
});

function sendFill(message: {
  type: string;
  draft?: { subreddit?: string; title?: string; body?: string };
}) {
  const sendResponse = vi.fn();
  const keepChannelOpen = listener(message as never, {}, sendResponse);
  return { sendResponse, keepChannelOpen };
}

const fill = (subreddit = "iosdev") =>
  sendFill({
    type: "POSTONE_REDDIT_FILL",
    draft: { subreddit, title: "뮤터 출시 후기", body: "첫 문단\n\n둘째 문단" },
  });

describe("content-reddit submit fill", () => {
  it("fills the title textarea and the contenteditable body", async () => {
    document.body.innerHTML = `
      <shreddit-composer>
        <textarea name="title" placeholder="Title" style="opacity: 1"></textarea>
        <div contenteditable="true" role="textbox" data-placeholder="Text (optional)" style="opacity: 1"></div>
      </shreddit-composer>`;
    const title = document.querySelector("textarea") as HTMLTextAreaElement;
    const body = document.querySelector("[contenteditable]") as HTMLElement;
    const onInput = vi.fn();
    title.addEventListener("input", onInput);
    body.addEventListener("input", onInput);

    const { sendResponse, keepChannelOpen } = fill();
    expect(keepChannelOpen).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse.mock.calls[0][0]).toMatchObject({ ok: true });
    expect(title.value).toBe("뮤터 출시 후기");
    expect(body.textContent).toContain("첫 문단");
    expect(body.textContent).toContain("둘째 문단");
    expect(onInput).toHaveBeenCalled();
  });

  it("does not write the body into the title field", async () => {
    document.body.innerHTML = `
      <div>
        <textarea name="title" placeholder="Title"></textarea>
        <div contenteditable="true" role="textbox" aria-label="Body"></div>
      </div>`;
    const title = document.querySelector("textarea") as HTMLTextAreaElement;
    const body = document.querySelector("[contenteditable]") as HTMLElement;

    const { sendResponse } = fill();
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(title.value).toBe("뮤터 출시 후기");
    expect(body.textContent).toContain("첫 문단");
  });

  it("fills the subreddit hint on the /submit community screen", async () => {
    window.history.replaceState({}, "", "/submit");
    document.body.innerHTML = `
      <input name="subreddit" placeholder="Choose a community" />
      <textarea name="title" placeholder="Title"></textarea>
      <div contenteditable="true" role="textbox"></div>`;

    const { sendResponse } = fill("iosdev");
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    const input = document.querySelector("input") as HTMLInputElement;
    expect(sendResponse.mock.calls[0][0]).toMatchObject({ ok: true });
    expect(input.value).toBe("iosdev");
    expect(sendResponse.mock.calls[0][0].filled?.subreddit).toBe(true);
    expect(sendResponse.mock.calls[0][0].message).toContain("직접 게시");
  });

  it("asks the user to pick the subreddit when the /submit picker is missing", async () => {
    window.history.replaceState({}, "", "/submit");
    document.body.innerHTML = `
      <textarea name="title" placeholder="Title"></textarea>
      <div contenteditable="true" role="textbox"></div>`;

    const { sendResponse } = fill("iosdev");
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse.mock.calls[0][0]).toMatchObject({ ok: true });
    expect(sendResponse.mock.calls[0][0].message).toContain("서브레딧을 직접 선택");
  });

  it("reports a clear message when the title field is missing", async () => {
    document.body.innerHTML = "<p>피드만 있는 화면</p>";

    const { sendResponse } = fill();
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled(), {
      timeout: 6000,
    });

    expect(sendResponse.mock.calls[0][0]).toMatchObject({ ok: false });
    expect(sendResponse.mock.calls[0][0].message).toContain("제목 입력창을 찾지 못했습니다");
  });

  it("refuses an empty title or body", async () => {
    document.body.innerHTML = `
      <textarea name="title" placeholder="Title"></textarea>
      <div contenteditable="true" role="textbox"></div>`;

    const empty = sendFill({
      type: "POSTONE_REDDIT_FILL",
      draft: { subreddit: "", title: "  ", body: "본문" },
    });
    await vi.waitFor(() => expect(empty.sendResponse).toHaveBeenCalled());
    expect(empty.sendResponse.mock.calls[0][0]).toMatchObject({ ok: false });
  });

  it("fills a composer rendered inside open shadow roots (current Reddit UI)", async () => {
    document.body.innerHTML = `<shreddit-composer></shreddit-composer>`;
    const composer = document.querySelector("shreddit-composer") as HTMLElement;
    const root = composer.attachShadow({ mode: "open" });

    const titleHost = document.createElement("faceplate-textarea-input");
    titleHost.setAttribute("name", "title");
    const titleShadow = titleHost.attachShadow({ mode: "open" });
    const innerTitle = document.createElement("textarea");
    innerTitle.id = "innerTextArea";
    innerTitle.setAttribute("maxlength", "300");
    titleShadow.appendChild(innerTitle);
    root.appendChild(titleHost);

    const body = document.createElement("div");
    body.setAttribute("name", "body");
    body.setAttribute("contenteditable", "true");
    body.setAttribute("data-lexical-editor", "true");
    root.appendChild(body);

    const { sendResponse } = fill();
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse.mock.calls[0][0]).toMatchObject({ ok: true });
    expect(innerTitle.value).toBe("뮤터 출시 후기");
    expect(body.textContent).toContain("첫 문단");
  });

  it("answers a status check with whether both fields exist", async () => {
    document.body.innerHTML = `
      <textarea name="title" placeholder="Title"></textarea>
      <div contenteditable="true" role="textbox"></div>`;
    const sendResponse = vi.fn();
    listener({ type: "POSTONE_REDDIT_STATUS" } as never, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, ready: true });
  });
});
