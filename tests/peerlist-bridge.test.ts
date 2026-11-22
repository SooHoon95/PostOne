import { describe, it, expect } from "vitest";
import {
  PEERLIST_ACK_TIMEOUT_MS,
  PEERLIST_DRAFT_STORAGE_KEY,
  PEERLIST_EXTENSION_SOURCE,
  PEERLIST_MESSAGE,
  POSTONE_WEB_SOURCE,
  buildPeerlistDraftMessage,
  createPeerlistBridge,
  parsePeerlistExtensionMessage,
  readPeerlistAck,
  type PeerlistBridgeWindow,
} from "@/lib/extension/peerlist-bridge";

const ORIGIN = "https://postone-sigma.vercel.app";

class FakeWindow implements PeerlistBridgeWindow {
  sent: { message: unknown; targetOrigin: string }[] = [];
  listeners = new Set<(event: MessageEvent) => void>();

  postMessage = (message: unknown, targetOrigin: string) => {
    this.sent.push({ message, targetOrigin });
  };

  addEventListener = (_type: "message", listener: (event: MessageEvent) => void) => {
    this.listeners.add(listener);
  };

  removeEventListener = (_type: "message", listener: (event: MessageEvent) => void) => {
    this.listeners.delete(listener);
  };

  emit(
    data: unknown,
    options: { source?: unknown; origin?: string } = {}
  ) {
    const event = {
      data,
      source: options.source === undefined ? this : options.source,
      origin: options.origin ?? ORIGIN,
    } as unknown as MessageEvent;
    for (const listener of Array.from(this.listeners)) listener(event);
  }

  get lastMessage() {
    return this.sent[this.sent.length - 1]?.message as Record<string, unknown>;
  }
}

function readyEvent() {
  return {
    source: PEERLIST_EXTENSION_SOURCE,
    type: PEERLIST_MESSAGE.ready,
    payload: { version: "1.0.0" },
  };
}

function ackEvent(payload: unknown) {
  return {
    source: PEERLIST_EXTENSION_SOURCE,
    type: PEERLIST_MESSAGE.ack,
    payload,
  };
}

describe("peerlist extension message contract", () => {
  it("accepts only messages from the extension source with known types", () => {
    expect(parsePeerlistExtensionMessage(readyEvent())).toMatchObject({
      source: PEERLIST_EXTENSION_SOURCE,
      type: PEERLIST_MESSAGE.ready,
    });
    expect(
      parsePeerlistExtensionMessage({ source: "someone-else", type: PEERLIST_MESSAGE.ready })
    ).toBeNull();
    expect(
      parsePeerlistExtensionMessage({ source: PEERLIST_EXTENSION_SOURCE, type: "SOMETHING" })
    ).toBeNull();
    expect(parsePeerlistExtensionMessage(null)).toBeNull();
    expect(parsePeerlistExtensionMessage("legacy-string")).toBeNull();
  });

  it("reads ACK payloads and rejects malformed ones", () => {
    expect(readPeerlistAck({ ok: true })).toEqual({ ok: true, message: undefined });
    expect(readPeerlistAck({ ok: false, message: "저장 실패" })).toEqual({
      ok: false,
      message: "저장 실패",
    });
    expect(readPeerlistAck({ message: "ok 없음" })).toBeNull();
    expect(readPeerlistAck(undefined)).toBeNull();
  });

  it("builds the same draft payload the extension stores", () => {
    expect(buildPeerlistDraftMessage("본문", "2026-11-22T12:00:00.000Z")).toEqual({
      source: POSTONE_WEB_SOURCE,
      type: PEERLIST_MESSAGE.draft,
      payload: { content: "본문", updatedAt: "2026-11-22T12:00:00.000Z" },
    });
    expect(PEERLIST_DRAFT_STORAGE_KEY).toBe("peerlistDraft");
  });
});

describe("createPeerlistBridge", () => {
  it("pings the page and becomes ready on READY", () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, { origin: ORIGIN });
    const states: boolean[] = [];
    bridge.onReadyChange((ready) => states.push(ready));

    expect(bridge.isReady).toBe(false);
    bridge.ping();
    expect(target.lastMessage).toEqual({
      source: POSTONE_WEB_SOURCE,
      type: PEERLIST_MESSAGE.ping,
    });
    expect(target.sent[0].targetOrigin).toBe(ORIGIN);

    target.emit(readyEvent());
    expect(bridge.isReady).toBe(true);
    expect(states).toEqual([true]);
    bridge.dispose();
  });

  it("sends a draft and resolves on ACK", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, { origin: ORIGIN });
    target.emit(readyEvent());

    const pending = bridge.sendDraft("뮤터 앱을 출시했다.", {
      updatedAt: "2026-11-22T12:00:00.000Z",
    });
    expect(target.lastMessage).toEqual({
      source: POSTONE_WEB_SOURCE,
      type: PEERLIST_MESSAGE.draft,
      payload: { content: "뮤터 앱을 출시했다.", updatedAt: "2026-11-22T12:00:00.000Z" },
    });

    target.emit(ackEvent({ ok: true }));
    await expect(pending).resolves.toEqual({ ok: true });
    bridge.dispose();
  });

  it("surfaces a rejected ACK with its message", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, { origin: ORIGIN });
    target.emit(readyEvent());

    const pending = bridge.sendDraft("초안");
    target.emit(ackEvent({ ok: false, message: "초안이 너무 깁니다." }));
    await expect(pending).resolves.toEqual({
      ok: false,
      reason: "rejected",
      message: "초안이 너무 깁니다.",
    });
    bridge.dispose();
  });

  it("times out when the extension never acknowledges", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, {
      origin: ORIGIN,
      ackTimeoutMs: 30,
    });
    target.emit(readyEvent());

    await expect(bridge.sendDraft("초안")).resolves.toEqual({
      ok: false,
      reason: "timeout",
    });
    bridge.dispose();
  });

  it("reports no-extension when nothing answers the PING (clipboard fallback)", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, {
      origin: ORIGIN,
      readyTimeoutMs: 25,
    });

    await expect(bridge.sendDraft("초안")).resolves.toEqual({
      ok: false,
      reason: "no-extension",
    });
    expect(
      target.sent.some(
        (entry) =>
          (entry.message as Record<string, unknown>).type === PEERLIST_MESSAGE.ping
      )
    ).toBe(true);
    bridge.dispose();
  });

  it("rejects empty drafts without messaging the page", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, { origin: ORIGIN });
    target.emit(readyEvent());

    await expect(bridge.sendDraft("   ")).resolves.toMatchObject({
      ok: false,
      reason: "rejected",
    });
    expect(target.sent).toHaveLength(0);
    bridge.dispose();
  });

  it("ignores messages from another source frame or origin", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, {
      origin: ORIGIN,
      readyTimeoutMs: 20,
    });

    target.emit(readyEvent(), { source: {} });
    expect(bridge.isReady).toBe(false);

    target.emit(readyEvent(), { origin: "https://evil.example" });
    expect(bridge.isReady).toBe(false);

    target.emit({ ...readyEvent(), source: "someone-else" });
    expect(bridge.isReady).toBe(false);

    bridge.dispose();
  });

  it("uses the live ACK timeout constant by default", () => {
    expect(PEERLIST_ACK_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("resolves in-flight drafts and stops listening on dispose", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, { origin: ORIGIN });
    target.emit(readyEvent());

    const pending = bridge.sendDraft("초안");
    bridge.dispose();
    await expect(pending).resolves.toEqual({ ok: false, reason: "no-extension" });
    expect(target.listeners.size).toBe(0);
  });

  it("does not hang when ACK arrives before a draft is sent", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, { origin: ORIGIN });
    target.emit(readyEvent());
    target.emit(ackEvent({ ok: true }));

    const pending = bridge.sendDraft("초안");
    target.emit(ackEvent({ ok: true }));
    await expect(pending).resolves.toEqual({ ok: true });
    bridge.dispose();
  });
});
