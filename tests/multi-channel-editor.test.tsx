import { render, screen } from "@testing-library/react";
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
  updatedAt: null,
};

const baseProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publish: vi.fn(async () => ({ results: [] })) as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadBackground: vi.fn(async () => ({})) as any,
  saveDraft: vi.fn(async () => ({ ok: true })),
  deleteDraft: vi.fn(async () => {}),
  connectedChannels: { linkedin: true, threads: true, instagram: true },
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
