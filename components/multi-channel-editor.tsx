"use client";

import { useState, useMemo, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { BUCKET } from "@/lib/cards/upload";
import type {
  Channel,
  ChannelResult,
  InstagramCard,
  MultiPublishInput,
  UploadResult,
} from "@/app/(app)/compose/actions";
import type { DraftData } from "@/lib/drafts/actions";

const BACKGROUND_MAX_BYTES = 8 * 1024 * 1024; // 8MB

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type TemplateName = "minimal-white" | "gradient" | "photo-overlay";

const LIMITS = {
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

const ORDINAL = ["첫번째", "두번째", "세번째", "네번째", "다섯번째", "여섯번째", "일곱번째", "여덟번째", "아홉번째", "열번째"];

type SaveStatus = "idle" | "saving" | "saved";

export function MultiChannelEditor({
  publish,
  uploadBackground,
  connectedChannels,
  initialDraft,
  saveDraft,
  deleteDraft,
}: {
  publish: (input: MultiPublishInput) => Promise<{ results: ChannelResult[] }>;
  uploadBackground: (fileExt: string) => Promise<UploadResult>;
  connectedChannels: Record<Channel, boolean>;
  initialDraft: DraftData | null;
  saveDraft: (input: DraftData) => Promise<{ ok: boolean }>;
  deleteDraft: () => Promise<void>;
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

  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ChannelResult[] | null>(null);

  // 임시저장 복원 배너 (initialDraft가 있고 아직 선택 전이면 노출)
  const [showRestoreBanner, setShowRestoreBanner] = useState(!!initialDraft);
  // 자동저장 상태 표시
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // 카드 배경 이미지 업로드 상태 (카드 인덱스별)
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({});

  const selectedChannels = useMemo(
    () =>
      (Object.keys(selected) as Channel[]).filter(
        (c) => selected[c] && connectedChannels[c]
      ),
    [selected, connectedChannels]
  );

  const bodyChannelsSelected =
    selectedChannels.includes("linkedin") || selectedChannels.includes("threads");

  // 복원 배너: 이어쓰기 — draft 내용으로 폼 채움 (연결된 채널만)
  function continueDraft() {
    if (!initialDraft) return;
    setBody(initialDraft.body);
    setCards(initialDraft.instagramCards);
    setIgTemplate(initialDraft.instagramTemplate as TemplateName);
    setSelected({
      linkedin:
        connectedChannels.linkedin &&
        initialDraft.selectedChannels.includes("linkedin"),
      threads:
        connectedChannels.threads &&
        initialDraft.selectedChannels.includes("threads"),
      instagram:
        connectedChannels.instagram &&
        initialDraft.selectedChannels.includes("instagram"),
    });
    setShowRestoreBanner(false);
  }

  // 복원 배너: 새로 시작 — 서버 draft 삭제 + 빈 폼 유지
  function discardDraft() {
    setShowRestoreBanner(false);
    void deleteDraft();
  }

  // 자동저장: 변경 시 디바운스 2.5초 후 saveDraft. 빈 상태면 스킵.
  // 복원 배너가 떠 있는 동안(선택 전)에는 저장하지 않는다.
  const isEmptyDraft =
    body.trim().length === 0 &&
    cards.length === 0 &&
    selectedChannels.length === 0;

  useEffect(() => {
    if (showRestoreBanner) return;
    if (isEmptyDraft) return;

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const r = await saveDraft({
          body,
          instagramCards: cards,
          instagramTemplate: igTemplate,
          selectedChannels,
        });
        setSaveStatus(r.ok ? "saved" : "idle");
      } catch {
        // 자동저장 실패는 조용히 무시 (다음 변경에 재시도)
        setSaveStatus("idle");
      }
    }, 2500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, cards, igTemplate, selectedChannels, showRestoreBanner, isEmptyDraft]);

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

  function setBackground(idx: number, url: string | undefined) {
    setCards((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, backgroundImageUrl: url } : c
      )
    );
  }

  async function onPickBackground(idx: number, file: File | undefined) {
    if (!file) return;
    setUploadErrors((e) => ({ ...e, [idx]: "" }));
    if (!file.type.startsWith("image/")) {
      setUploadErrors((e) => ({ ...e, [idx]: "이미지 파일만 가능" }));
      return;
    }
    if (file.size > BACKGROUND_MAX_BYTES) {
      setUploadErrors((e) => ({ ...e, [idx]: "8MB 이하만 가능" }));
      return;
    }
    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
      setUploadErrors((e) => ({ ...e, [idx]: "JPG · PNG · WEBP만 가능" }));
      return;
    }
    setUploadingIdx(idx);
    try {
      const res = await uploadBackground(ext);
      if (res.error || !res.path || !res.token || !res.publicUrl) {
        setUploadErrors((e) => ({ ...e, [idx]: res.error ?? "업로드 실패" }));
        return;
      }
      const supabase = createBrowserClient();
      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(res.path, res.token, file, {
          contentType: file.type,
        });
      if (error) {
        setUploadErrors((e) => ({ ...e, [idx]: "업로드 실패" }));
        return;
      }
      setBackground(idx, res.publicUrl);
    } catch {
      setUploadErrors((e) => ({ ...e, [idx]: "업로드 실패" }));
    } finally {
      setUploadingIdx(null);
    }
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
      });
      setResults(r.results);
      if (r.results.every((x) => x.success)) {
        setBody("");
        setCards([]);
        setSaveStatus("idle");
        void deleteDraft();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting && selectedChannels.length > 0 && (bodyChannelsSelected ? body.trim().length > 0 : true);

  return (
    <div className="space-y-6">
      {/* 복원 배너 */}
      {showRestoreBanner && (
        <Card className="flex flex-col gap-3 border-primary/40 bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              작성 중이던 글 있음
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              이전에 작성하던 내용을 이어서 작성할 수 있습니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={continueDraft}>
              이어쓰기
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={discardDraft}
            >
              새로 시작
            </Button>
          </div>
        </Card>
      )}

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

      {/* 본문 (항상 표시) */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">본문 (LinkedIn·Threads 발행 / Instagram 캡션)</p>
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="본문을 작성하세요..."
        />
        <div className="flex flex-wrap gap-4 text-xs">
          {selectedChannels.includes("linkedin") && (
            <span
              className={body.length > LIMITS.linkedin ? "text-destructive" : "text-muted-foreground"}
            >
              LinkedIn: {body.length} / {LIMITS.linkedin}
            </span>
          )}
          {selectedChannels.includes("threads") && (
            <span
              className={body.length > LIMITS.threads ? "text-destructive" : "text-muted-foreground"}
            >
              Threads: {body.length} / {LIMITS.threads}
            </span>
          )}
          {selectedChannels.includes("instagram") && (
            <span
              className={body.length > LIMITS.instagram ? "text-destructive" : "text-muted-foreground"}
            >
              Instagram: {body.length} / {LIMITS.instagram}
            </span>
          )}
        </div>
      </Card>

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

                  {/* 배경 이미지 */}
                  <div className="space-y-2">
                    {card.backgroundImageUrl ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.backgroundImageUrl}
                          alt=""
                          className="h-16 w-16 rounded-md border border-input object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setBackground(i, undefined)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          배경 제거
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-md border border-input bg-card px-3 py-1.5 text-foreground">
                          {uploadingIdx === i ? "업로드 중..." : "배경 이미지"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingIdx === i}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            onPickBackground(i, f);
                          }}
                        />
                        <span>JPG · PNG · 최대 8MB</span>
                      </label>
                    )}
                    {uploadErrors[i] && (
                      <p className="text-xs text-destructive">{uploadErrors[i]}</p>
                    )}
                  </div>
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
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            선택된 채널 {selectedChannels.length}개에 발행됩니다
          </p>
          {saveStatus === "saving" && (
            <span className="text-xs text-muted-foreground">저장 중...</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs text-muted-foreground">저장됨 · 방금</span>
          )}
        </div>
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
