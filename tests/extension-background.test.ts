import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, describe, it, expect, vi } from "vitest";

/**
 * extension/background.js의 저장·탭·채우기 중계를 가짜 chrome API로 검증한다.
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
    message: "작성창에 채웠습니다.",
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

const draft = { content: "Peerlist 초안", updatedAt: "2026-11-22T12:00:00.000Z" };

describe("background draft storage", () => {
  it("returns null when nothing is stored yet", async () => {
    await expect(send({ type: "POSTONE_GET_DRAFT" })).resolves.toEqual({
      ok: true,
      draft: null,
    });
  });

  it("saves and reads back a draft", async () => {
    await expect(
      send({ type: "POSTONE_SAVE_DRAFT", payload: draft })
    ).resolves.toMatchObject({ ok: true });

    expect(store.peerlistDraft).toEqual(draft);
    await expect(send({ type: "POSTONE_GET_DRAFT" })).resolves.toMatchObject({
      ok: true,
      draft,
    });
  });

  it("refuses empty drafts", async () => {
    await expect(
      send({ type: "POSTONE_SAVE_DRAFT", payload: { content: "  " } })
    ).resolves.toMatchObject({ ok: false });
    expect(store.peerlistDraft).toBeUndefined();
  });
});

describe("background Peerlist tab + fill", () => {
  it("creates a Peerlist tab when none is open", async () => {
    await expect(send({ type: "POSTONE_OPEN_PEERLIST" })).resolves.toMatchObject({
      ok: true,
      opened: "new",
    });
    expect(tabs.create).toHaveBeenCalledWith({ url: "https://peerlist.io/" });
  });

  it("focuses an existing Peerlist tab", async () => {
    tabs.query.mockResolvedValue([{ id: 7, windowId: 1 }]);
    await expect(send({ type: "POSTONE_OPEN_PEERLIST" })).resolves.toMatchObject({
      ok: true,
      opened: "existing",
    });
    expect(tabs.update).toHaveBeenCalledWith(7, { active: true });
  });

  it("forwards the draft to the Peerlist content script", async () => {
    tabs.query.mockResolvedValue([{ id: 7, windowId: 1 }]);

    const response = await send({
      type: "POSTONE_FILL_PEERLIST",
      payload: { content: draft.content },
    });

    expect(response).toMatchObject({ ok: true });
    expect(tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: "POSTONE_PEERLIST_FILL",
      content: draft.content,
    });
  });

  it("asks for a Peerlist tab before filling", async () => {
    await expect(
      send({ type: "POSTONE_FILL_PEERLIST", payload: { content: draft.content } })
    ).resolves.toMatchObject({
      ok: false,
      reason: "no-peerlist-tab",
    });
    expect(tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("reports a reload hint when the content script is missing", async () => {
    tabs.query.mockResolvedValue([{ id: 7, windowId: 1 }]);
    tabs.sendMessage.mockRejectedValue(new Error("Receiving end does not exist"));

    await expect(
      send({ type: "POSTONE_FILL_PEERLIST", payload: { content: draft.content } })
    ).resolves.toMatchObject({
      ok: false,
      reason: "no-content-script",
    });
  });

  it("ignores unknown messages", () => {
    expect(messageListener({ type: "UNKNOWN" }, {}, () => {})).toBe(false);
  });
});
