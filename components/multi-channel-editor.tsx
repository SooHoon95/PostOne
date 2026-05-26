"use client";

import { useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CharacterCounter } from "@/components/character-counter";
import type {
  Channel,
  ChannelResult,
  MultiPublishInput,
} from "@/app/(dashboard)/compose/actions";

type TemplateName = "minimal-white" | "gradient" | "photo-overlay";

const LIMITS: Record<Channel, number> = {
  linkedin: 3000,
  threads: 500,
  instagram: 2200,
};

const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: "LinkedIn",
  threads: "Threads",
  instagram: "Instagram",
};

const TEMPLATE_LABEL: Record<TemplateName, string> = {
  "minimal-white": "미니멀 화이트",
  gradient: "그라데이션",
  "photo-overlay": "다크 오버레이",
};

export function MultiChannelEditor({
  publish,
  connectedChannels,
}: {
  publish: (input: MultiPublishInput) => Promise<{ results: ChannelResult[] }>;
  connectedChannels: Record<Channel, boolean>;
}) {
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<Record<Channel, boolean>>({
    linkedin: connectedChannels.linkedin,
    threads: connectedChannels.threads,
    instagram: connectedChannels.instagram,
  });
  const [igTitle, setIgTitle] = useState("");
  const [igTemplate, setIgTemplate] =
    useState<TemplateName>("minimal-white");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ChannelResult[] | null>(null);

  const selectedChannels = useMemo(
    () =>
      (Object.keys(selected) as Channel[]).filter(
        (c) => selected[c] && connectedChannels[c]
      ),
    [selected, connectedChannels]
  );

  const overLimit = selectedChannels.some(
    (c) => content.length > LIMITS[c]
  );

  async function onSubmit() {
    setSubmitting(true);
    setResults(null);
    try {
      const r = await publish({
        content,
        channels: selectedChannels,
        instagramTemplate: igTemplate,
        instagramTitle: igTitle || undefined,
      });
      setResults(r.results);
      if (r.results.every((x) => x.success)) {
        setContent("");
        setIgTitle("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 채널 선택 */}
      <Card className="p-4">
        <p className="mb-3 text-sm font-medium">발행 채널</p>
        <div className="flex flex-wrap gap-4">
          {(["linkedin", "threads", "instagram"] as Channel[]).map((c) => {
            const isConnected = connectedChannels[c];
            return (
              <label
                key={c}
                className={`flex items-center gap-2 text-sm ${
                  isConnected ? "" : "opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected[c]}
                  disabled={!isConnected}
                  onChange={(e) =>
                    setSelected({ ...selected, [c]: e.target.checked })
                  }
                />
                <span>{CHANNEL_LABEL[c]}</span>
                {!isConnected && (
                  <span className="text-xs text-slate-500">(미연결)</span>
                )}
              </label>
            );
          })}
        </div>
      </Card>

      {/* 본문 */}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        placeholder="여러 채널에 한 번에 발행할 글을 작성하세요..."
      />

      <div className="flex items-center justify-between text-xs">
        <div className="flex flex-wrap gap-4 text-slate-600">
          {selectedChannels.map((c) => (
            <span
              key={c}
              className={content.length > LIMITS[c] ? "text-red-600" : ""}
            >
              {CHANNEL_LABEL[c]}: {content.length} / {LIMITS[c]}
            </span>
          ))}
        </div>
      </div>

      {/* Instagram 옵션 */}
      {selected.instagram && connectedChannels.instagram && (
        <Card className="p-4 space-y-3">
          <p className="text-sm font-medium">Instagram 카드 옵션</p>
          <div className="space-y-2">
            <Label htmlFor="ig-title">제목 (선택, 첫 슬라이드 hero)</Label>
            <Input
              id="ig-title"
              value={igTitle}
              onChange={(e) => setIgTitle(e.target.value)}
              placeholder="예: 직장인이 알면 좋은 5가지"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ig-template">템플릿</Label>
            <select
              id="ig-template"
              value={igTemplate}
              onChange={(e) => setIgTemplate(e.target.value as TemplateName)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {(Object.keys(TEMPLATE_LABEL) as TemplateName[]).map((t) => (
                <option key={t} value={t}>
                  {TEMPLATE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          선택된 채널 {selectedChannels.length}개에 발행됩니다
        </p>
        <Button
          onClick={onSubmit}
          disabled={
            submitting ||
            !content.trim() ||
            selectedChannels.length === 0 ||
            overLimit
          }
        >
          {submitting
            ? "발행 중..."
            : `${selectedChannels.length}개 채널에 발행`}
        </Button>
      </div>

      {/* 결과 */}
      {results && (
        <Card className="p-4 space-y-2">
          <p className="text-sm font-medium">발행 결과</p>
          {results.map((r) => (
            <div
              key={r.channel}
              className={`rounded border p-3 text-sm ${
                r.success
                  ? "border-green-300 bg-green-50 text-green-900"
                  : "border-red-300 bg-red-50 text-red-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{CHANNEL_LABEL[r.channel]}</span>
                <span>{r.success ? "✓ 성공" : "✗ 실패"}</span>
              </div>
              {r.externalId && (
                <p className="mt-1 text-xs opacity-75">ID: {r.externalId}</p>
              )}
              {r.error && (
                <p className="mt-1 text-xs">{r.error}</p>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
