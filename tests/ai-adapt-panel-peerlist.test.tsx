import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { AiAdaptPanel } from "@/components/ai-adapt-panel";
import {
  PEERLIST_EXTENSION_SOURCE,
  PEERLIST_MESSAGE,
} from "@/lib/extension/peerlist-bridge";

const PEERLIST_DRAFT = "AI 피어리스트 초안";

function stubAdaptFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        channels: { peerlist: { content: PEERLIST_DRAFT } },
        warnings: [],
      }),
    }))
  );
}

function extensionEvent(type: string, payload?: unknown) {
  return new MessageEvent("message", {
    data: { source: PEERLIST_EXTENSION_SOURCE, type, payload },
    origin: window.location.origin,
  });
}

async function renderWithPeerlistDraft() {
  render(<AiAdaptPanel sourceText="뮤터 앱 출시" channels={["peerlist"]} onApply={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "AI 변환" }));
  await waitFor(() =>
    expect(screen.getByDisplayValue(PEERLIST_DRAFT)).toBeInTheDocument()
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AiAdaptPanel — Peerlist 확장 연동", () => {
  it("shows the extension state and both Peerlist actions", async () => {
    stubAdaptFetch();
    await renderWithPeerlistDraft();

    expect(
      screen.getByRole("button", { name: "Peerlist 확장으로 전송" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Peerlist 초안 복사" })
    ).toBeInTheDocument();
  });

  it("falls back to the clipboard when the extension does not answer", async () => {
    stubAdaptFetch();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await renderWithPeerlistDraft();
    fireEvent.click(
      screen.getByRole("button", { name: "Peerlist 확장으로 전송" })
    );

    await waitFor(
      () =>
        expect(
          screen.getByText(/확장 미연결 — 초안을 복사했습니다/)
        ).toBeInTheDocument(),
      { timeout: 3000 }
    );
    expect(writeText).toHaveBeenCalledWith(PEERLIST_DRAFT);
  });

  it("posts the draft to the extension and confirms the ACK", async () => {
    stubAdaptFetch();
    const postMessage = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {});

    await renderWithPeerlistDraft();

    act(() => {
      window.dispatchEvent(extensionEvent(PEERLIST_MESSAGE.ready));
    });
    await waitFor(() =>
      expect(screen.getByText(/확장 연결됨/)).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Peerlist 확장으로 전송" })
    );

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PEERLIST_MESSAGE.draft,
          payload: expect.objectContaining({ content: PEERLIST_DRAFT }),
        }),
        window.location.origin
      )
    );

    act(() => {
      window.dispatchEvent(extensionEvent(PEERLIST_MESSAGE.ack, { ok: true }));
    });

    await waitFor(() =>
      expect(screen.getByText(/확장에 저장됨/)).toBeInTheDocument()
    );
  });
});
