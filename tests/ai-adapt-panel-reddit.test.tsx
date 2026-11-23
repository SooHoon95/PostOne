import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { AiAdaptPanel } from "@/components/ai-adapt-panel";
import {
  PEERLIST_EXTENSION_SOURCE,
  PEERLIST_MESSAGE,
} from "@/lib/extension/peerlist-bridge";

const REDDIT_TITLE = "뮤터 앱 출시 후기";
const REDDIT_BODY = "iOS 사이드 프로젝트로 음악 편지 앱을 만들었다.";

function stubAdaptFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        channels: {
          reddit: { title: REDDIT_TITLE, content: REDDIT_BODY },
        },
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

async function renderWithRedditDraft(redditConnected = false) {
  render(
    <AiAdaptPanel
      sourceText="뮤터 앱 출시"
      channels={["reddit"]}
      subreddit="iosdev"
      redditConnected={redditConnected}
      onApply={() => {}}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "AI 변환" }));
  await waitFor(() =>
    expect(screen.getByDisplayValue(REDDIT_TITLE)).toBeInTheDocument()
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AiAdaptPanel — Reddit 확장 연동", () => {
  it("shows the OAuth-missing hint and both Reddit actions", async () => {
    stubAdaptFetch();
    await renderWithRedditDraft(false);

    expect(screen.getByText("OAuth 미연결")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reddit 확장으로 전송" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reddit 초안 복사" })
    ).toBeInTheDocument();
    expect(screen.getByText(/OAuth 미연결 — 확장으로/)).toBeInTheDocument();
  });

  it("hides the OAuth hint when Reddit is connected", async () => {
    stubAdaptFetch();
    await renderWithRedditDraft(true);
    expect(screen.queryByText("OAuth 미연결")).not.toBeInTheDocument();
  });

  it("sends the Reddit draft (title/body/subreddit) to the extension", async () => {
    stubAdaptFetch();
    const postMessage = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {});

    await renderWithRedditDraft(false);

    act(() => {
      window.dispatchEvent(extensionEvent(PEERLIST_MESSAGE.ready));
    });
    await waitFor(() =>
      expect(screen.getByText(/확장 연결됨/)).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Reddit 확장으로 전송" })
    );

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PEERLIST_MESSAGE.redditDraft,
          payload: expect.objectContaining({
            subreddit: "iosdev",
            title: REDDIT_TITLE,
            body: REDDIT_BODY,
          }),
        }),
        window.location.origin
      )
    );

    act(() => {
      window.dispatchEvent(extensionEvent(PEERLIST_MESSAGE.ack, { ok: true }));
    });

    await waitFor(() =>
      expect(screen.getByText(/확장에 저장됨 — 툴바/)).toBeInTheDocument()
    );
  });

  it("falls back to copying title+body when the extension is missing", async () => {
    stubAdaptFetch();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await renderWithRedditDraft(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Reddit 확장으로 전송" })
    );

    await waitFor(
      () =>
        expect(
          screen.getByText(/확장 미연결 — 제목·본문을 복사했습니다/)
        ).toBeInTheDocument(),
      { timeout: 3000 }
    );
    expect(writeText).toHaveBeenCalledWith(
      `${REDDIT_TITLE}\n\n${REDDIT_BODY}`
    );
  });

  it("keeps the send button disabled until a title exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          channels: { reddit: { title: "", content: REDDIT_BODY } },
          warnings: [],
        }),
      }))
    );

    render(
      <AiAdaptPanel
        sourceText="뮤터 앱 출시"
        channels={["reddit"]}
        subreddit="iosdev"
        onApply={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "AI 변환" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Reddit 확장으로 전송" })
      ).toBeDisabled()
    );
  });
});
