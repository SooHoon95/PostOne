import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MultiChannelEditor } from "@/components/multi-channel-editor";
import type { DraftData } from "@/lib/drafts/actions";

/**
 * Regression: clicking "이어쓰기" on /drafts must land the user in the composer
 * with the saved body already filled in. Previously the editor always started
 * empty and only restored on a second click in the restore banner, so the body
 * appeared blank after "이어쓰기".
 */
const draft: DraftData = {
  body: "이어서 쓸 본문 내용",
  instagramCards: [],
  instagramTemplate: "minimal-white",
  selectedChannels: ["linkedin"],
  reddit: { subreddit: "", title: "", link: "", flairId: "" },
  updatedAt: null,
};

const baseProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publish: vi.fn(async () => ({ results: [] })) as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schedule: vi.fn(async () => ({ ok: true })) as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadBackground: vi.fn(async () => ({})) as any,
  saveDraft: vi.fn(async () => ({ ok: true })),
  deleteDraft: vi.fn(async () => {}),
  connectedChannels: {
    linkedin: true,
    threads: true,
    instagram: true,
    reddit: false,
  },
};

describe("MultiChannelEditor — draft continuation", () => {
  it("autoContinue prefills the body and hides the restore banner", () => {
    render(
      <MultiChannelEditor {...baseProps} initialDraft={draft} autoContinue />
    );
    expect(screen.getByPlaceholderText("본문을 작성하세요...")).toHaveValue(
      draft.body
    );
    expect(screen.queryByText("작성 중이던 글 있음")).not.toBeInTheDocument();
  });

  it("without autoContinue the body is empty and the restore banner shows", () => {
    render(<MultiChannelEditor {...baseProps} initialDraft={draft} />);
    expect(screen.getByPlaceholderText("본문을 작성하세요...")).toHaveValue("");
    expect(screen.getByText("작성 중이던 글 있음")).toBeInTheDocument();
  });
});

describe("MultiChannelEditor — AI 채널별 변환", () => {
  it("shows the AI panel and keeps the button disabled until a draft exists", () => {
    render(<MultiChannelEditor {...baseProps} initialDraft={null} />);
    expect(screen.getByText("AI 채널별 변환")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 변환" })).toBeDisabled();
  });

  it("applies converted text as per-channel content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          channels: {
            linkedin: { content: "AI 링크드인 본문" },
            peerlist: { content: "AI 피어리스트 초안" },
          },
          warnings: [],
        }),
      }))
    );

    render(<MultiChannelEditor {...baseProps} initialDraft={draft} autoContinue />);
    fireEvent.click(screen.getByRole("button", { name: "AI 변환" }));

    await waitFor(() =>
      expect(screen.getByDisplayValue("AI 링크드인 본문")).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue("AI 피어리스트 초안")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "전체 적용" }));
    expect(screen.getByText("채널별 맞춤 본문 적용")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
