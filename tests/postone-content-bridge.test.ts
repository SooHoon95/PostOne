import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, it, expect, vi } from "vitest";
import {
  PEERLIST_EXTENSION_SOURCE,
  PEERLIST_MESSAGE,
  buildPeerlistDraftMessage,
  buildPeerlistPingMessage,
} from "@/lib/extension/peerlist-bridge";

/**
 * 실제 익스텐션 content script(extension/content-postone.js)를 jsdom 전역에서 실행해,
 * PostOne 웹이 보내는 PING → READY, DRAFT → ACK 계약을 끝까지 검증한다.
 *
 * jsdom의 window.postMessage는 같은 창 메시지의 origin을 빈 문자열로 두기 때문에
 * (실제 Chrome은 location.origin), 주입은 MessageEvent로 직접 한다.
 */
const SOURCE = readFileSync(
  path.resolve(__dirname, "../extension/content-postone.js"),
  "utf8"
);

type PageMessage = { source?: string; type?: string; payload?: unknown };

let savedDraft: unknown = null;
const received: PageMessage[] = [];

function dispatchToPage(data: unknown, origin = window.location.origin) {
  window.dispatchEvent(
    new MessageEvent("message", { data, origin, source: window })
  );
}

function findReceived(type: string) {
  return received.find((message) => message.type === type);
}

beforeAll(() => {
  vi.stubGlobal("chrome", {
    runtime: {
      getManifest: () => ({ version: "1.0.0" }),
      sendMessage: (
        message: { type: string; payload?: unknown },
        callback: (response: unknown) => void
      ) => {
        if (message.type === "POSTONE_SAVE_DRAFT") {
          savedDraft = message.payload;
          callback({ ok: true });
          return;
        }
        callback(undefined);
      },
    },
    storage: {
      local: {
        set: (items: { peerlistDraft?: unknown }, callback: () => void) => {
          savedDraft = items.peerlistDraft;
          callback();
        },
      },
    },
  });

  window.addEventListener("message", (event) => {
    const data = event.data as PageMessage;
    if (data && data.source === PEERLIST_EXTENSION_SOURCE) received.push(data);
  });

  new Function(SOURCE)();
});

describe("content-postone contract", () => {
  it("announces READY and answers PING", async () => {
    await vi.waitFor(() => expect(findReceived(PEERLIST_MESSAGE.ready)).toBeTruthy());

    received.length = 0;
    dispatchToPage(buildPeerlistPingMessage());
    await vi.waitFor(() => expect(findReceived(PEERLIST_MESSAGE.ready)).toBeTruthy());
  });

  it("stores a posted draft and replies ACK", async () => {
    received.length = 0;
    savedDraft = null;

    dispatchToPage(
      buildPeerlistDraftMessage("뮤터 앱을 출시했다.", "2026-11-22T12:00:00.000Z")
    );

    await vi.waitFor(() =>
      expect(findReceived(PEERLIST_MESSAGE.ack)).toBeTruthy()
    );
    expect(savedDraft).toEqual({
      content: "뮤터 앱을 출시했다.",
      updatedAt: "2026-11-22T12:00:00.000Z",
    });
    expect(findReceived(PEERLIST_MESSAGE.ack)?.payload).toMatchObject({
      ok: true,
      content: "뮤터 앱을 출시했다.",
    });
  });

  it("rejects an empty draft with a failed ACK", async () => {
    received.length = 0;
    savedDraft = null;

    dispatchToPage(buildPeerlistDraftMessage("   ", "2026-11-22T12:00:00.000Z"));

    await vi.waitFor(() =>
      expect(findReceived(PEERLIST_MESSAGE.ack)).toBeTruthy()
    );
    expect(findReceived(PEERLIST_MESSAGE.ack)?.payload).toMatchObject({ ok: false });
    expect(savedDraft).toBeNull();
  });

  it("ignores messages from other origins and foreign sources", async () => {
    received.length = 0;
    dispatchToPage(buildPeerlistPingMessage(), "https://evil.example");
    dispatchToPage({ source: "someone-else", type: PEERLIST_MESSAGE.ping });

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(findReceived(PEERLIST_MESSAGE.ready)).toBeUndefined();
  });
});
