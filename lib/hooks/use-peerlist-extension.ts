"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PEERLIST_READY_TIMEOUT_MS,
  createPeerlistBridge,
  type PeerlistBridge,
  type PeerlistBridgeWindow,
  type PeerlistSendResult,
  type RedditDraftInput,
} from "@/lib/extension/peerlist-bridge";

export type PeerlistExtensionState = "checking" | "ready" | "missing";

/**
 * PostOne 크롬 익스텐션 연결 상태 + 초안 전송 (Peerlist · Reddit 공용).
 *
 * content script는 document_idle에 로드될 수 있어 PING을 몇 번 다시 보내고,
 * 약 2.6초 동안 응답이 없을 때만 "missing"(복사 폴백 안내)으로 확정한다.
 */
export function useExtensionBridge() {
  const [state, setState] = useState<PeerlistExtensionState>("checking");
  const bridgeRef = useRef<PeerlistBridge | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const bridge = createPeerlistBridge(
      window as unknown as PeerlistBridgeWindow,
      { origin: window.location.origin }
    );
    bridgeRef.current = bridge;

    const unsubscribe = bridge.onReadyChange((ready) => {
      setState(ready ? "ready" : "checking");
    });

    bridge.ping();
    const retryTimers = [
      window.setTimeout(() => bridge.ping(), 600),
      window.setTimeout(() => bridge.ping(), PEERLIST_READY_TIMEOUT_MS * 2),
    ];
    const settleTimer = window.setTimeout(() => {
      if (!bridge.isReady) setState("missing");
    }, PEERLIST_READY_TIMEOUT_MS * 4 + 400);

    return () => {
      for (const timer of retryTimers) window.clearTimeout(timer);
      window.clearTimeout(settleTimer);
      unsubscribe();
      bridge.dispose();
      bridgeRef.current = null;
    };
  }, []);

  const sendDraft = useCallback(
    async (content: string): Promise<PeerlistSendResult> => {
      const bridge = bridgeRef.current;
      if (!bridge) return { ok: false, reason: "no-extension" };
      const result = await bridge.sendDraft(content);
      if (!result.ok && result.reason === "no-extension") setState("missing");
      return result;
    },
    []
  );

  const sendRedditDraft = useCallback(
    async (draft: RedditDraftInput): Promise<PeerlistSendResult> => {
      const bridge = bridgeRef.current;
      if (!bridge) return { ok: false, reason: "no-extension" };
      const result = await bridge.sendRedditDraft(draft);
      if (!result.ok && result.reason === "no-extension") setState("missing");
      return result;
    },
    []
  );

  return { state, sendDraft, sendRedditDraft };
}

/** Peerlist만 쓰는 화면용 별칭 */
export function usePeerlistExtension() {
  const { state, sendDraft } = useExtensionBridge();
  return { state, sendDraft };
}
