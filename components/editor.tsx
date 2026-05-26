"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CharacterCounter } from "@/components/character-counter";

const LINKEDIN_MAX = 3000;

export function Editor({
  publish,
}: {
  publish: (input: {
    content: string;
  }) => Promise<{ urn?: string; error?: string }>;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok?: string;
    error?: string;
  } | null>(null);

  async function onSubmit() {
    setSubmitting(true);
    setFeedback(null);
    const result = await publish({ content });
    setSubmitting(false);
    if (result.error) {
      setFeedback({ error: result.error });
    } else {
      setFeedback({ ok: `발행 완료 (URN: ${result.urn})` });
      setContent("");
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        placeholder="LinkedIn에 발행할 글을 작성하세요..."
      />
      <div className="flex items-center justify-between">
        <CharacterCounter value={content.length} max={LINKEDIN_MAX} />
        <Button onClick={onSubmit} disabled={submitting || !content.trim()}>
          {submitting ? "발행 중..." : "LinkedIn에 발행"}
        </Button>
      </div>
      {feedback?.error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {feedback.error}
        </p>
      )}
      {feedback?.ok && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {feedback.ok}
        </p>
      )}
    </div>
  );
}
