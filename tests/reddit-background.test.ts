import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, describe, it, expect, vi } from "vitest";

/**
 * extension/background.js의 Reddit 초안 저장·탭 열기·채우기 중계를
 * 가짜 chrome API로 검증한다.
 */
const SOURCE = readFileSync(
  path.resolve(__dirname, "../extension/background.js"),
  "utf8"
);

type MessageListener = (
  message: { type?: string; payload?: unknown },
  sender: unknown,
  sendResponse: (response: unknown) => void
) => boolean | undefined;

let messageListener: MessageListener;
const store: Record<string, unknown> = {};

const tabs = {
  query: vi.fn(async (): Promise<{ id?: number; windowId?: number }[]> => []),
  update: vi.fn(async () => ({})),
  create: vi.fn(async () => ({ id: 99 })),
  sendMessage: vi.fn(async () => ({ ok: true, message: "작성창에 채웠습니다." })),
};

beforeAll(() => {
  vi.stubGlobal("chrome", {
    runtime: {
      lastError: undefined,
      onInstalled: { addListener: vi.fn() },
      onMessage: {
        addListener: (fn: MessageListener) => {
          messageListener = fn;
        },
      },
    },
    storage: {
      local: {
        get: (key: string, callback: (items: Record<string, unknown>) => void) => {
          callback(store[key] === undefined ? {} : { [key]: store[key] });
        },
        set: (items: Record<string, unknown>, callback?: () => void) => {
          Object.assign(store, items);
          if (callback) callback();
        },
      },
    },
    tabs,
    windows: { update: vi.fn(async () => ({})) },
    action: {
      setBadgeText: vi.fn(async () => {}),
      setBadgeBackgroundColor: vi.fn(async () => {}),
    },
  });
  new Function(SOURCE)();
});

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  tabs.query.mockClear().mockResolvedValue([]);
  tabs.update.mockClear();
  tabs.create.mockClear();
  tabs.sendMessage.mockClear().mockResolvedValue({
    ok: true,
    message: "Reddit 제목·본문을 채웠습니다.",
  });
});

function send(message: { type: string; payload?: unknown }) {
  return new Promise<Record<string, unknown> | undefined>((resolve) => {
    const keepOpen = messageListener(message, {}, (response) =>
      resolve(response as Record<string, unknown> | undefined)
    );
    expect(keepOpen).toBe(true);
  });
}

const draft = {
  subreddit: "iosdev",
  title: "뮤터 출시 후기",
  body: "iOS 사이드 프로젝트 회고",
  updatedAt: "2026-11-23T10:00:00.000Z",
};

describe("background reddit draft storage", () => {
  it("returns null when nothing is stored yet", async () => {
    await expect(send({ type: "POSTONE_GET_REDDIT_DRAFT" })).resolves.toEqual({
      ok: true,
      draft: null,
    });
  });

  it("saves and reads back a reddit draft", async () => {
    await expect(
      send({ type: "POSTONE_SAVE_REDDIT_DRAFT", payload: draft })
    ).resolves.toMatchObject({ ok: true });

    expect(store.redditDraft).toMatchObject({
      subreddit: "iosdev",
      title: "뮤터 출시 후기",
      body: "iOS 사이드 프로젝트 회고",
    });
    await expect(send({ type: "POSTONE_GET_REDDIT_DRAFT" })).resolves.toMatchObject(
      { ok: true, draft: { title: "뮤터 출시 후기" } }
    );
  });

  it("normalizes an r/ prefixed subreddit and drops an invalid one", async () => {
    await send({
      type: "POSTONE_SAVE_REDDIT_DRAFT",
      payload: { ...draft, subreddit: "r/iosdev" },
    });
    expect((store.redditDraft as { subreddit: string }).subreddit).toBe("iosdev");

    await expect(
      send({
        type: "POSTONE_SAVE_REDDIT_DRAFT",
        payload: { ...draft, subreddit: "bad name!" },
      })
    ).resolves.toMatchObject({ ok: false });
  });

  it("refuses an empty title or body", async () => {
    await expect(
      send({
        type: "POSTONE_SAVE_REDDIT_DRAFT",
        payload: { ...draft, title: "  " },
      })
    ).resolves.toMatchObject({ ok: false });
    await expect(
      send({
        type: "POSTONE_SAVE_REDDIT_DRAFT",
        payload: { ...draft, body: "" },
      })
    ).resolves.toMatchObject({ ok: false });
    expect(store.redditDraft).toBeUndefined();
  });
});

describe("background Reddit tab + fill", () => {
  it("opens r/<sub>/submit when a subreddit hint exists", async () => {
    await expect(
      send({ type: "POSTONE_OPEN_REDDIT", payload: { subreddit: "iosdev" } })
    ).resolves.toMatchObject({ ok: true, opened: "new" });
    expect(tabs.create).toHaveBeenCalledWith({
      url: "https://www.reddit.com/r/iosdev/submit?type=TEXT",
    });
  });

  it("opens /submit without a valid hint", async () => {
    await send({ type: "POSTONE_OPEN_REDDIT", payload: {} });
    expect(tabs.create).toHaveBeenCalledWith({
      url: "https://www.reddit.com/submit?type=TEXT",
    });
  });

  it("focuses an existing Reddit submit tab", async () => {
    tabs.query.mockResolvedValue([{ id: 5, windowId: 2 }]);
    await expect(send({ type: "POSTONE_OPEN_REDDIT" })).resolves.toMatchObject({
      ok: true,
      opened: "existing",
    });
    expect(tabs.update).toHaveBeenCalledWith(5, { active: true });
  });

  it("forwards the draft to the Reddit content script", async () => {
    tabs.query.mockResolvedValue([{ id: 5, windowId: 2 }]);

    const response = await send({ type: "POSTONE_FILL_REDDIT", payload: draft });

    expect(response).toMatchObject({ ok: true });
    expect(tabs.sendMessage).toHaveBeenCalledWith(5, {
      type: "POSTONE_REDDIT_FILL",
      draft: { subreddit: "iosdev", title: draft.title, body: draft.body },
    });
  });

  it("asks for a Reddit submit tab before filling", async () => {
    await expect(
      send({ type: "POSTONE_FILL_REDDIT", payload: draft })
    ).resolves.toMatchObject({ ok: false, reason: "no-reddit-tab" });
    expect(tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("reports a reload hint when the content script is missing", async () => {
    tabs.query.mockResolvedValue([{ id: 5, windowId: 2 }]);
    tabs.sendMessage.mockRejectedValue(new Error("Receiving end does not exist"));

    await expect(
      send({ type: "POSTONE_FILL_REDDIT", payload: draft })
    ).resolves.toMatchObject({ ok: false, reason: "no-content-script" });
  });

  it("refuses to fill without a title or body", async () => {
    tabs.query.mockResolvedValue([{ id: 5, windowId: 2 }]);
    await expect(
      send({ type: "POSTONE_FILL_REDDIT", payload: { ...draft, title: "" } })
    ).resolves.toMatchObject({ ok: false });
    expect(tabs.sendMessage).not.toHaveBeenCalled();
  });
});
