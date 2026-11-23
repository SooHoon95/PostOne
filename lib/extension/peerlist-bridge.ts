/**
 * PostOne 웹 ↔ Peerlist 크롬 익스텐션의 window.postMessage 계약.
 *
 * 웹(PostOne)은 같은 창에 초안을 postMessage로 던지고, 익스텐션 content script가
 * chrome.storage.local에 저장한 뒤 ACK를 돌려준다. 이 모듈은 그 계약의 순수 로직만
 * 담아 단위 테스트가 가능하도록 분리했다.
 *
 * 확장 쪽 구현은 `extension/` 아래 순수 JS라 TypeScript를 import할 수 없으므로
 * 메시지 타입 문자열·저장 키는 양쪽에 같은 값으로 적혀 있다(tests/extension-manifest 참고).
 *
 * 같은 채널로 Reddit 초안(제목·본문·서브레딧)도 보낸다 — 확장은 저장한 뒤
 * popup의 'Reddit 작성창에 채우기'로 reddit.com/submit 을 채운다(게시는 사용자).
 */
import {
  REDDIT_DRAFT_STORAGE_KEY,
  validateRedditDraftInput,
  type RedditDraftInput,
  type RedditExtensionDraft,
} from "./reddit-draft";

export { REDDIT_DRAFT_STORAGE_KEY, type RedditDraftInput };

export const POSTONE_WEB_SOURCE = "postone-web";
export const PEERLIST_EXTENSION_SOURCE = "postone-extension";

export const PEERLIST_MESSAGE = {
  /** 익스텐션 → 웹: content script 로드 완료 */
  ready: "POSTONE_EXTENSION_READY",
  /** 웹 → 익스텐션: 설치 확인 */
  ping: "POSTONE_EXTENSION_PING",
  /** 웹 → 익스텐션: Peerlist 초안 저장 요청 */
  draft: "POSTONE_PEERLIST_DRAFT",
  /** 웹 → 익스텐션: Reddit 초안(제목·본문·서브레딧) 저장 요청 */
  redditDraft: "POSTONE_REDDIT_DRAFT",
  /** 익스텐션 → 웹: 저장 결과 */
  ack: "POSTONE_EXTENSION_ACK",
} as const;

export type PeerlistMessageType =
  (typeof PEERLIST_MESSAGE)[keyof typeof PEERLIST_MESSAGE];

const MESSAGE_TYPES: readonly string[] = Object.values(PEERLIST_MESSAGE);

/** chrome.storage.local 키 — extension/background.js와 같은 값 */
export const PEERLIST_DRAFT_STORAGE_KEY = "peerlistDraft";

/** 초안 전송 후 ACK를 기다리는 시간(ms) */
export const PEERLIST_ACK_TIMEOUT_MS = 1500;

/** 확장 설치 확인(PING) 응답을 기다리는 시간(ms) */
export const PEERLIST_READY_TIMEOUT_MS = 600;

export type PeerlistExtensionMessage = {
  source: typeof PEERLIST_EXTENSION_SOURCE;
  type: PeerlistMessageType;
  payload?: unknown;
};

export type PeerlistDraft = { content: string; updatedAt: string };

export type PeerlistAckPayload = { ok: boolean; message?: string };

export type PeerlistSendResult =
  | { ok: true }
  | {
      ok: false;
      reason: "no-extension" | "timeout" | "rejected";
      message?: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 익스텐션이 보낸 메시지만 통과시킨다(출처 문자열 + 알려진 타입). */
export function parsePeerlistExtensionMessage(
  data: unknown
): PeerlistExtensionMessage | null {
  if (!isRecord(data)) return null;
  if (data.source !== PEERLIST_EXTENSION_SOURCE) return null;
  if (typeof data.type !== "string" || !MESSAGE_TYPES.includes(data.type)) {
    return null;
  }
  return {
    source: PEERLIST_EXTENSION_SOURCE,
    type: data.type as PeerlistMessageType,
    payload: data.payload,
  };
}

/** ACK payload → { ok, message } (형식이 어긋나면 null) */
export function readPeerlistAck(payload: unknown): PeerlistAckPayload | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.ok !== "boolean") return null;
  return {
    ok: payload.ok,
    message:
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : undefined,
  };
}

export function buildPeerlistPingMessage(): {
  source: typeof POSTONE_WEB_SOURCE;
  type: typeof PEERLIST_MESSAGE.ping;
} {
  return { source: POSTONE_WEB_SOURCE, type: PEERLIST_MESSAGE.ping };
}

export function buildPeerlistDraftMessage(
  content: string,
  updatedAt: string
): {
  source: typeof POSTONE_WEB_SOURCE;
  type: typeof PEERLIST_MESSAGE.draft;
  payload: PeerlistDraft;
} {
  return {
    source: POSTONE_WEB_SOURCE,
    type: PEERLIST_MESSAGE.draft,
    payload: { content, updatedAt },
  };
}

/** Reddit 초안 — 확장 background가 chrome.storage.local["redditDraft"]에 저장한다. */
export function buildRedditDraftMessage(
  draft: RedditExtensionDraft
): {
  source: typeof POSTONE_WEB_SOURCE;
  type: typeof PEERLIST_MESSAGE.redditDraft;
  payload: RedditExtensionDraft;
} {
  return {
    source: POSTONE_WEB_SOURCE,
    type: PEERLIST_MESSAGE.redditDraft,
    payload: {
      subreddit: draft.subreddit,
      title: draft.title,
      body: draft.body,
      updatedAt: draft.updatedAt,
    },
  };
}

/** postMessage를 보낼 수 있는 최소 창 인터페이스(테스트에서 대체 가능) */
export type PeerlistBridgeWindow = {
  postMessage(message: unknown, targetOrigin: string): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void
  ): void;
};

export type PeerlistBridgeOptions = {
  /** 같은 출처 메시지만 받는다(보통 window.location.origin) */
  origin?: string;
  /** ACK 대기 시간(ms) */
  ackTimeoutMs?: number;
  /** PING 응답 대기 시간(ms) */
  readyTimeoutMs?: number;
  now?: () => Date;
};

export type PeerlistBridge = {
  readonly isReady: boolean;
  /** 설치 확인 상태 변화 구독 — 해제 함수를 돌려준다 */
  onReadyChange(listener: (ready: boolean) => void): () => void;
  /** 설치 확인 PING 전송 */
  ping(): void;
  /**
   * PING 응답을 기다린다. already ready면 즉시 true.
   * 확장 미설치로 판단되면 false(클립보드 폴백 신호).
   */
  waitForReady(timeoutMs?: number): Promise<boolean>;
  /** 초안 전송 — ACK 성공 여부를 결과로 돌려준다 */
  sendDraft(
    content: string,
    options?: { updatedAt?: string; waitReadyMs?: number }
  ): Promise<PeerlistSendResult>;
  /** Reddit 초안 전송 — 제목·본문·서브레딧을 확장 저장소로 넘긴다 */
  sendRedditDraft(
    draft: RedditDraftInput,
    options?: { updatedAt?: string; waitReadyMs?: number }
  ): Promise<PeerlistSendResult>;
  dispose(): void;
};

/**
 * PostOne 페이지에서 Peerlist 익스텐션과 대화하는 브리지.
 * window를 그대로 넘겨도 되고, 테스트에서는 가짜 창을 넘긴다.
 */
export function createPeerlistBridge(
  target: PeerlistBridgeWindow,
  options: PeerlistBridgeOptions = {}
): PeerlistBridge {
  const origin = options.origin;
  const ackTimeoutMs = options.ackTimeoutMs ?? PEERLIST_ACK_TIMEOUT_MS;
  const readyTimeoutMs = options.readyTimeoutMs ?? PEERLIST_READY_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());

  let ready = false;
  let disposed = false;
  let pending:
    | {
        resolve: (result: PeerlistSendResult) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | null = null;

  const readyListeners = new Set<(ready: boolean) => void>();
  const readyWaiters = new Set<{
    resolve: (ready: boolean) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  function post(message: unknown) {
    try {
      target.postMessage(message, origin ?? "*");
    } catch {
      // 창이 닫혔거나 잘못된 origin — 결과는 타임아웃으로 처리된다.
    }
  }

  function finishReadyWaiters(value: boolean) {
    readyWaiters.forEach((waiter) => {
      clearTimeout(waiter.timer);
      waiter.resolve(value);
    });
    readyWaiters.clear();
  }

  function markReady() {
    if (ready) return;
    ready = true;
    readyListeners.forEach((listener) => listener(true));
    finishReadyWaiters(true);
  }

  function settlePending(result: PeerlistSendResult) {
    if (!pending) return;
    const entry = pending;
    pending = null;
    clearTimeout(entry.timer);
    entry.resolve(result);
  }

  function handleMessage(event: MessageEvent) {
    if (disposed) return;
    const source = event.source as unknown;
    if (source != null && source !== (target as unknown)) return;
    if (origin && event.origin && event.origin !== origin) return;

    const message = parsePeerlistExtensionMessage(event.data);
    if (!message) return;

    if (message.type === PEERLIST_MESSAGE.ready) {
      markReady();
      return;
    }
    if (message.type === PEERLIST_MESSAGE.ack) {
      const ack = readPeerlistAck(message.payload);
      if (!ack) {
        settlePending({
          ok: false,
          reason: "rejected",
          message: "확장 응답을 읽지 못했습니다.",
        });
        return;
      }
      if (ack.ok) {
        settlePending({ ok: true });
      } else {
        settlePending({
          ok: false,
          reason: "rejected",
          message: ack.message ?? "확장이 초안을 저장하지 못했습니다.",
        });
      }
    }
  }

  target.addEventListener("message", handleMessage);

  function waitForReady(timeout: number = readyTimeoutMs): Promise<boolean> {
    if (ready) return Promise.resolve(true);
    if (disposed) return Promise.resolve(false);
    post(buildPeerlistPingMessage());
    return new Promise((resolve) => {
      const waiter = {
        resolve,
        timer: 0 as unknown as ReturnType<typeof setTimeout>,
      };
      waiter.timer = setTimeout(() => {
        readyWaiters.delete(waiter);
        resolve(false);
      }, timeout);
      readyWaiters.add(waiter);
    });
  }

  /** 공통 전송 — PING 대기·중복 방지·ACK 타임아웃 처리 */
  async function sendMessage(
    message: unknown,
    waitReadyMs?: number
  ): Promise<PeerlistSendResult> {
    if (disposed) return { ok: false, reason: "no-extension" };
    if (!ready) {
      const installed = await waitForReady(waitReadyMs ?? readyTimeoutMs);
      if (!installed) return { ok: false, reason: "no-extension" };
    }
    if (pending) {
      return {
        ok: false,
        reason: "rejected",
        message: "이전 전송을 기다리는 중입니다.",
      };
    }
    return new Promise<PeerlistSendResult>((resolve) => {
      const timer = setTimeout(() => {
        pending = null;
        resolve({ ok: false, reason: "timeout" });
      }, ackTimeoutMs);
      pending = { resolve, timer };
      post(message);
    });
  }

  return {
    get isReady() {
      return ready;
    },
    onReadyChange(listener) {
      readyListeners.add(listener);
      return () => {
        readyListeners.delete(listener);
      };
    },
    ping() {
      if (disposed) return;
      post(buildPeerlistPingMessage());
    },
    waitForReady,
    async sendDraft(content, { updatedAt, waitReadyMs } = {}) {
      if (disposed) return { ok: false, reason: "no-extension" };
      if (!content.trim()) {
        return {
          ok: false,
          reason: "rejected",
          message: "초안이 비어 있습니다.",
        };
      }
      return sendMessage(
        buildPeerlistDraftMessage(content, updatedAt ?? now().toISOString()),
        waitReadyMs
      );
    },
    async sendRedditDraft(draft, { updatedAt, waitReadyMs } = {}) {
      if (disposed) return { ok: false, reason: "no-extension" };
      const validated = validateRedditDraftInput(draft);
      if (!validated.ok) {
        return {
          ok: false,
          reason: "rejected",
          message: validated.message,
        };
      }
      const payload: RedditExtensionDraft = {
        subreddit: validated.draft.subreddit ?? "",
        title: validated.draft.title,
        body: validated.draft.body,
        updatedAt: updatedAt ?? now().toISOString(),
      };
      return sendMessage(buildRedditDraftMessage(payload), waitReadyMs);
    },
    dispose() {
      disposed = true;
      target.removeEventListener("message", handleMessage);
      readyListeners.clear();
      finishReadyWaiters(false);
      settlePending({ ok: false, reason: "no-extension" });
    },
  };
}
