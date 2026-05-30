"use client";

import { useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  Channel,
  ChannelResult,
  InstagramCard,
  MultiPublishInput,
} from "@/app/(dashboard)/compose/actions";

type TemplateName = "minimal-white" | "gradient" | "photo-overlay";

const LIMITS = {
  linkedin: 3000,
  threads: 500,
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

const ORDINAL = ["첫번째", "두번째", "세번째", "네번째", "다섯번째", "여섯번째", "일곱번째", "여덟번째", "아홉번째", "열번째"];

export function MultiChannelEditor({
  publish,
  connectedChannels,
}: {
  publish: (input: MultiPublishInput) => Promise<{ results: ChannelResult[] }>;
  connectedChannels: Record<Channel, boolean>;
}) {
  const [selected, setSelected] = useState<Record<Channel, boolean>>({
    linkedin: connectedChannels.linkedin,
    threads: connectedChannels.threads,
    instagram: connectedChannels.instagram,
  });

  const [body, setBody] = useState("");

  // Instagram 카드 상태
  const [cards, setCards] = useState<InstagramCard[]>([]);
  const [igTemplate, setIgTemplate] = useState<TemplateName>("minimal-white");
  const [igCaption, setIgCaption] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ChannelResult[] | null>(null);

  const selectedChannels = useMemo(
    () =>
      (Object.keys(selected) as Channel[]).filter(
        (c) => selected[c] && connectedChannels[c]
      ),
    [selected, connectedChannels]
  );

  const bodyChannelsSelected =
    selectedChannels.includes("linkedin") || selectedChannels.includes("threads");

  function addCard() {
    if (cards.length >= 10) return;
    setCards([...cards, { title: "", description: "" }]);
  }

  function removeCard(idx: number) {
    setCards(cards.filter((_, i) => i !== idx));
  }

  function updateCard(idx: number, field: keyof InstagramCard, value: string) {
    setCards(cards.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }

  async function onSubmit() {
    setSubmitting(true);
    setResults(null);
    try {
      const r = await publish({
        channels: selectedChannels,
        body,
        instagramCards: cards,
        instagramTemplate: igTemplate,
        instagramCaption: igCaption || undefined,
      });
      setResults(r.results);
      if (r.results.every((x) => x.success)) {
        setBody("");
        setCards([]);
        setIgCaption("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting && selectedChannels.length > 0 && (bodyChannelsSelected ? body.trim().length > 0 : true);

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
                  <span className="text-xs text-muted-foreground">(미연결)</span>
                )}
              </label>
            );
          })}
        </div>
      </Card>

      {/* 본문 (LinkedIn + Threads) */}
      {bodyChannelsSelected && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">본문</p>
            <span className="text-xs text-muted-foreground">LinkedIn, Threads 발행용</span>
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="본문을 작성하세요..."
          />
          <div className="flex gap-4 text-xs">
            {selectedChannels.includes("linkedin") && (
              <span
                className={body.length > LIMITS.linkedin ? "text-red-600" : "text-muted-foreground"}
              >
                LinkedIn: {body.length} / {LIMITS.linkedin}
              </span>
            )}
            {selectedChannels.includes("threads") && (
              <span
                className={body.length > LIMITS.threads ? "text-red-600" : "text-muted-foreground"}
              >
                Threads: {body.length} / {LIMITS.threads}
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Instagram 카드 */}
      {selected.instagram && connectedChannels.instagram && (
        <Card className="p-4 space-y-4">
          <p className="text-sm font-medium">Instagram 카드</p>

          {/* 템플릿 선택 */}
          <div className="space-y-2">
            <Label htmlFor="ig-template">템플릿 (톤앤매너)</Label>
            <select
              id="ig-template"
              value={igTemplate}
              onChange={(e) => setIgTemplate(e.target.value as TemplateName)}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              {(Object.keys(TEMPLATE_LABEL) as TemplateName[]).map((t) => (
                <option key={t} value={t}>
                  {TEMPLATE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          {/* 카드 영역 */}
          {cards.length === 0 ? (
            <div className="rounded-md border border-dashed border-input bg-muted p-4">
              <p className="text-sm font-medium text-foreground">기본 카드 생성</p>
              <p className="mt-1 text-xs text-muted-foreground">
                카드를 추가하지 않으면 빈 카드 1장이 자동 발행됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cards.map((card, i) => (
                <div
                  key={i}
                  className="rounded-md border border bg-card p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {ORDINAL[i] ?? `${i + 1}번째`} 카드
                    </p>
                    <button
                      type="button"
                      onClick={() => removeCard(i)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                  <Input
                    value={card.title}
                    onChange={(e) => updateCard(i, "title", e.target.value)}
                    placeholder="제목"
                  />
                  <Textarea
                    value={card.description}
                    onChange={(e) => updateCard(i, "description", e.target.value)}
                    rows={3}
                    placeholder="설명"
                  />
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={addCard}
            disabled={cards.length >= 10}
            className="w-full"
          >
            + 카드 추가 ({cards.length}/10)
          </Button>

          {/* 캡션 */}
          <div className="space-y-2">
            <Label htmlFor="ig-caption">캡션 (선택, 게시물 아래 텍스트)</Label>
            <Textarea
              id="ig-caption"
              value={igCaption}
              onChange={(e) => setIgCaption(e.target.value)}
              rows={3}
              placeholder="비워두면 카드 내용으로 자동 생성됩니다."
            />
            <p className="text-xs text-muted-foreground">{igCaption.length} / 2200</p>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          선택된 채널 {selectedChannels.length}개에 발행됩니다
        </p>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {submitting ? "발행 중..." : `${selectedChannels.length}개 채널에 발행`}
        </Button>
      </div>

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
              {r.error && <p className="mt-1 text-xs">{r.error}</p>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
