import { describe, it, expect } from "vitest";
import {
  PEERLIST_EXTENSION_SOURCE,
  PEERLIST_MESSAGE,
  POSTONE_WEB_SOURCE,
  REDDIT_DRAFT_STORAGE_KEY,
  buildRedditDraftMessage,
  createPeerlistBridge,
  type PeerlistBridgeWindow,
} from "@/lib/extension/peerlist-bridge";
import {
  REDDIT_BODY_MAX,
  REDDIT_SUBMIT_URL_PATTERNS,
  REDDIT_TITLE_MAX,
  normalizeRedditSubreddit,
  redditSubmitUrl,
  validateRedditDraftInput,
} from "@/lib/extension/reddit-draft";
import { CHANNEL_LIMITS } from "@/lib/ai/types";

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

  emit(data: unknown) {
    const event = {
      data,
      source: this,
      origin: ORIGIN,
    } as unknown as MessageEvent;
    for (const listener of Array.from(this.listeners)) listener(event);
  }

  get lastMessage() {
    return this.sent[this.sent.length - 1]?.message as Record<string, unknown>;
  }
}

const ready = () => ({
  source: PEERLIST_EXTENSION_SOURCE,
  type: PEERLIST_MESSAGE.ready,
  payload: { version: "1.1.0" },
});

const ack = (payload: unknown) => ({
  source: PEERLIST_EXTENSION_SOURCE,
  type: PEERLIST_MESSAGE.ack,
  payload,
});

const draft = {
  subreddit: "iosdev",
  title: "사이드 프로젝트로 만든 iOS 앱 후기",
  body: "뮤터를 출시했다.\n\n음악 편지 앱이다.",
};

describe("reddit draft contract", () => {
  it("matches the AI channel limits", () => {
    expect(REDDIT_TITLE_MAX).toBe(CHANNEL_LIMITS.reddit.title);
    expect(REDDIT_BODY_MAX).toBe(CHANNEL_LIMITS.reddit.content);
    expect(REDDIT_DRAFT_STORAGE_KEY).toBe("redditDraft");
    expect(PEERLIST_MESSAGE.redditDraft).toBe("POSTONE_REDDIT_DRAFT");
  });

  it("normalizes subreddit hints and builds the submit URL", () => {
    expect(normalizeRedditSubreddit(" r/iosdev ")).toBe("iosdev");
    expect(normalizeRedditSubreddit("/r/SwiftUI")).toBe("SwiftUI");
    expect(redditSubmitUrl("iosdev")).toBe(
      "https://www.reddit.com/r/iosdev/submit"
    );
    expect(redditSubmitUrl("r/iosdev")).toBe(
      "https://www.reddit.com/r/iosdev/submit"
    );
    expect(redditSubmitUrl("")).toBe("https://www.reddit.com/submit");
    expect(redditSubmitUrl("bad name!")).toBe("https://www.reddit.com/submit");
    expect(REDDIT_SUBMIT_URL_PATTERNS).toEqual([
      "https://www.reddit.com/submit*",
      "https://www.reddit.com/r/*/submit*",
    ]);
  });

  it("validates title, body, length and subreddit shape", () => {
    expect(validateRedditDraftInput(draft)).toEqual({
      ok: true,
      draft: { subreddit: "iosdev", title: draft.title, body: draft.body },
    });

    expect(validateRedditDraftInput({ ...draft, title: "  " })).toMatchObject({
      ok: false,
    });
    expect(validateRedditDraftInput({ ...draft, body: "" })).toMatchObject({
      ok: false,
    });
    expect(
      validateRedditDraftInput({ ...draft, title: "가".repeat(REDDIT_TITLE_MAX + 1) })
    ).toMatchObject({ ok: false });
    expect(
      validateRedditDraftInput({ ...draft, subreddit: "bad name!" })
    ).toMatchObject({ ok: false });
  });

  it("builds the message the extension stores", () => {
    expect(
      buildRedditDraftMessage({
        ...draft,
        updatedAt: "2026-11-23T10:00:00.000Z",
      })
    ).toEqual({
      source: POSTONE_WEB_SOURCE,
      type: PEERLIST_MESSAGE.redditDraft,
      payload: { ...draft, updatedAt: "2026-11-23T10:00:00.000Z" },
    });
  });
});

describe("bridge.sendRedditDraft", () => {
  it("posts the reddit draft and resolves on ACK", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, { origin: ORIGIN });
    target.emit(ready());

    const pending = bridge.sendRedditDraft(draft, {
      updatedAt: "2026-11-23T10:00:00.000Z",
    });

    expect(target.lastMessage).toEqual({
      source: POSTONE_WEB_SOURCE,
      type: PEERLIST_MESSAGE.redditDraft,
      payload: {
        subreddit: "iosdev",
        title: draft.title,
        body: draft.body,
        updatedAt: "2026-11-23T10:00:00.000Z",
      },
    });

    target.emit(ack({ ok: true }));
    await expect(pending).resolves.toEqual({ ok: true });
    bridge.dispose();
  });

  it("drops an empty subreddit hint instead of failing", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, { origin: ORIGIN });
    target.emit(ready());

    const pending = bridge.sendRedditDraft({ ...draft, subreddit: " " });
    expect((target.lastMessage.payload as Record<string, unknown>).subreddit).toBe(
      ""
    );
    target.emit(ack({ ok: true }));
    await expect(pending).resolves.toEqual({ ok: true });
    bridge.dispose();
  });

  it("rejects an empty title without messaging the page", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, { origin: ORIGIN });
    target.emit(ready());

    await expect(
      bridge.sendRedditDraft({ ...draft, title: "  " })
    ).resolves.toMatchObject({ ok: false, reason: "rejected" });
    expect(target.sent).toHaveLength(0);
    bridge.dispose();
  });

  it("surfaces the extension's rejection message", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, { origin: ORIGIN });
    target.emit(ready());

    const pending = bridge.sendRedditDraft(draft);
    target.emit(ack({ ok: false, message: "Reddit 본문은 최대 40000자입니다." }));
    await expect(pending).resolves.toEqual({
      ok: false,
      reason: "rejected",
      message: "Reddit 본문은 최대 40000자입니다.",
    });
    bridge.dispose();
  });

  it("reports no-extension when the extension is not installed", async () => {
    const target = new FakeWindow();
    const bridge = createPeerlistBridge(target, {
      origin: ORIGIN,
      readyTimeoutMs: 20,
    });

    await expect(bridge.sendRedditDraft(draft)).resolves.toEqual({
      ok: false,
      reason: "no-extension",
    });
    bridge.dispose();
  });
});
