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
import type { DraftData, DraftReddit } from "@/lib/drafts/actions";
import { isValidSubreddit, normalizeSubreddit } from "@/lib/reddit/subreddit";
import { AiAdaptPanel, type AiApplyPayload } from "@/components/ai-adapt-panel";
import type { AIChannel } from "@/lib/ai/types";

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
  reddit: 40000,
};

const REDDIT_TITLE_MAX = 300;

const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: "LinkedIn",
  threads: "Threads",
  instagram: "Instagram",
  reddit: "Reddit",
};

const EMPTY_REDDIT: DraftReddit = {
  subreddit: "",
  title: "",
  link: "",
  flairId: "",
};

type FlairOption = { id: string; text: string };

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
  autoContinue = false,
  saveDraft,
  deleteDraft,
}: {
  publish: (input: MultiPublishInput) => Promise<{ results: ChannelResult[] }>;
  uploadBackground: (fileExt: string) => Promise<UploadResult>;
  connectedChannels: Record<Channel, boolean>;
  initialDraft: DraftData | null;
  autoContinue?: boolean;
  saveDraft: (input: DraftData) => Promise<{ ok: boolean }>;
  deleteDraft: () => Promise<void>;
}) {
  // /drafts "이어쓰기"(autoContinue)로 진입하면 저장된 글로 폼을 바로 채운다.
  // 일반 진입(네비 "글쓰기")은 빈 폼 + 복원 배너로 둔다.
  const restore = autoContinue && initialDraft ? initialDraft : null;

  const [selected, setSelected] = useState<Record<Channel, boolean>>(
    restore
      ? {
          linkedin:
            connectedChannels.linkedin &&
            restore.selectedChannels.includes("linkedin"),
          threads:
            connectedChannels.threads &&
            restore.selectedChannels.includes("threads"),
          instagram:
            connectedChannels.instagram &&
            restore.selectedChannels.includes("instagram"),
          reddit:
            connectedChannels.reddit &&
            restore.selectedChannels.includes("reddit"),
        }
      : {
          linkedin: connectedChannels.linkedin,
          threads: connectedChannels.threads,
          instagram: connectedChannels.instagram,
          reddit: connectedChannels.reddit,
        }
  );

  const [body, setBody] = useState(restore ? restore.body : "");

  // AI 채널별 변환 결과 — 채널별 본문 오버라이드(없으면 body 폴백).
  const [channelContents, setChannelContents] = useState<
    Partial<Record<Channel, string>>
  >({});

  // Reddit 입력 (서브레딧·제목은 필수, 링크·플레어는 선택)
  const [reddit, setReddit] = useState<DraftReddit>(
    restore ? restore.reddit : EMPTY_REDDIT
  );
  const [flairs, setFlairs] = useState<FlairOption[]>([]);
  const [flairsLoading, setFlairsLoading] = useState(false);

  // Instagram 카드 상태
  const [cards, setCards] = useState<InstagramCard[]>(
    restore ? restore.instagramCards : []
  );
  const [igTemplate, setIgTemplate] = useState<TemplateName>(
    restore ? (restore.instagramTemplate as TemplateName) : "minimal-white"
  );

  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ChannelResult[] | null>(null);

  // 임시저장 복원 배너 (initialDraft가 있고 아직 선택 전이면 노출)
  const [showRestoreBanner, setShowRestoreBanner] = useState(
    !!initialDraft && !autoContinue
  );
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

  // AI 변환 대상: 선택된 발행 채널 + Peerlist(3단계 익스텐션용 초안)
  const aiChannels = useMemo<AIChannel[]>(() => {
    const list: AIChannel[] = [...selectedChannels];
    if (!list.includes("peerlist")) list.push("peerlist");
    return list;
  }, [selectedChannels]);

  // 채널별 본문: AI 변환본 우선, 없으면 공통 body
  function contentFor(channel: Channel): string {
    return (channelContents[channel] ?? "").trim() || body;
  }

  const hasTailoredContent = selectedChannels.some((c) =>
    (channelContents[c] ?? "").trim()
  );

  function applyAiResult(payload: AiApplyPayload) {
    setChannelContents(payload.channelContents);
    if (payload.instagram) {
      // 기존 카드에 올린 배경 이미지는 순서대로 유지한다.
      setCards((prev) =>
        payload.instagram!.slides.map((slide, i) => ({
          title: slide.title,
          description: slide.description,
          backgroundImageUrl: prev[i]?.backgroundImageUrl,
        }))
      );
    }
    if (payload.redditTitle) {
      setReddit((prev) => ({ ...prev, title: payload.redditTitle ?? prev.title }));
    }
  }

  function clearTailoredContent() {
    setChannelContents({});
  }

  function updateReddit(patch: Partial<DraftReddit>) {
    setReddit((prev) => ({ ...prev, ...patch }));
  }

  // 복원 배너: 이어쓰기 — draft 내용으로 폼 채움 (연결된 채널만)
  function continueDraft() {
    if (!initialDraft) return;
    setBody(initialDraft.body);
    setCards(initialDraft.instagramCards);
    setIgTemplate(initialDraft.instagramTemplate as TemplateName);
    // 이전 글의 AI 변환본이 새 글로 새지 않게 비운다.
    setChannelContents({});
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
      reddit:
        connectedChannels.reddit &&
        initialDraft.selectedChannels.includes("reddit"),
    });
    setReddit(initialDraft.reddit);
    setShowRestoreBanner(false);
  }

  // 복원 배너: 새로 시작 — 서버 draft 삭제 + 빈 폼 유지
  function discardDraft() {
    setShowRestoreBanner(false);
    setChannelContents({});
    void deleteDraft();
  }

  // 자동저장: 변경 시 디바운스 2.5초 후 saveDraft. 빈 상태면 스킵.
  // 복원 배너가 떠 있는 동안(선택 전)에는 저장하지 않는다.
  const isEmptyDraft =
    body.trim().length === 0 &&
    cards.length === 0 &&
    reddit.subreddit.trim().length === 0 &&
    reddit.title.trim().length === 0 &&
    reddit.link.trim().length === 0 &&
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
          reddit,
        });
        setSaveStatus(r.ok ? "saved" : "idle");
      } catch {
        // 자동저장 실패는 조용히 무시 (다음 변경에 재시도)
        setSaveStatus("idle");
      }
    }, 2500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, cards, igTemplate, selectedChannels, reddit, showRestoreBanner, isEmptyDraft]);

  // Reddit 플레어 목록: 서브레딧이 유효해지면 디바운스로 조회.
  // 플레어는 선택 사항이므로 실패해도 선택지를 비우기만 하고 발행은 그대로 둔다.
  const flairSubreddit = normalizeSubreddit(reddit.subreddit);
  useEffect(() => {
    if (!selected.reddit || !connectedChannels.reddit) return;
    if (!isValidSubreddit(flairSubreddit)) {
      setFlairs([]);
      return;
    }
    let cancelled = false;
    setFlairsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/reddit/flairs?subreddit=${encodeURIComponent(flairSubreddit)}`
        );
        const data = (await res.json()) as { flairs?: FlairOption[] };
        if (cancelled) return;
        const list = Array.isArray(data.flairs) ? data.flairs : [];
        setFlairs(list);
        // 목록에 없는 플레어를 선택하고 있었다면 선택 해제
        setReddit((prev) =>
          prev.flairId && !list.some((f) => f.id === prev.flairId)
            ? { ...prev, flairId: "" }
            : prev
        );
      } catch {
        if (!cancelled) setFlairs([]);
      } finally {
        if (!cancelled) setFlairsLoading(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [flairSubreddit, selected.reddit, connectedChannels.reddit]);

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
      const tailored: Partial<Record<Channel, string>> = {};
      for (const channel of selectedChannels) {
        const value = (channelContents[channel] ?? "").trim();
        if (value) tailored[channel] = value;
      }

      const r = await publish({
        channels: selectedChannels,
        body,
        instagramCards: cards,
        instagramTemplate: igTemplate,
        reddit: {
          subreddit: normalizeSubreddit(reddit.subreddit),
          title: reddit.title.trim(),
          link: reddit.link.trim() || undefined,
          flairId: reddit.flairId || undefined,
        },
        channelContents: Object.keys(tailored).length > 0 ? tailored : undefined,
      });
      setResults(r.results);
      if (r.results.every((x) => x.success)) {
        setBody("");
        setCards([]);
        setReddit(EMPTY_REDDIT);
        setFlairs([]);
        setChannelContents({});
        setSaveStatus("idle");
        void deleteDraft();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const redditReady =
    !selectedChannels.includes("reddit") ||
    (isValidSubreddit(reddit.subreddit) && reddit.title.trim().length > 0);

  // Reddit 링크 글은 본문이 없어도 되므로 링크가 있으면 본문 검사에서 제외
  const channelContentReady = selectedChannels.every((channel) => {
    if (channel === "reddit" && reddit.link.trim()) return true;
    return contentFor(channel).trim().length > 0;
  });

  const canSubmit =
    !submitting &&
    selectedChannels.length > 0 &&
    redditReady &&
    channelContentReady;

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            본문 (LinkedIn · Threads · Reddit 텍스트 글 / Instagram 캡션)
          </p>
          {hasTailoredContent && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                채널별 맞춤 본문 적용
              </span>
              <button
                type="button"
                onClick={clearTailoredContent}
                className="text-xs text-muted-foreground hover:underline"
              >
                해제
              </button>
            </div>
          )}
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
              className={contentFor("linkedin").length > LIMITS.linkedin ? "text-destructive" : "text-muted-foreground"}
            >
              LinkedIn: {contentFor("linkedin").length} / {LIMITS.linkedin}
            </span>
          )}
          {selectedChannels.includes("threads") && (
            <span
              className={contentFor("threads").length > LIMITS.threads ? "text-destructive" : "text-muted-foreground"}
            >
              Threads: {contentFor("threads").length} / {LIMITS.threads}
            </span>
          )}
          {selectedChannels.includes("instagram") && (
            <span
              className={contentFor("instagram").length > LIMITS.instagram ? "text-destructive" : "text-muted-foreground"}
            >
              Instagram: {contentFor("instagram").length} / {LIMITS.instagram}
            </span>
          )}
          {selectedChannels.includes("reddit") && !reddit.link.trim() && (
            <span
              className={contentFor("reddit").length > LIMITS.reddit ? "text-destructive" : "text-muted-foreground"}
            >
              Reddit: {contentFor("reddit").length} / {LIMITS.reddit}
            </span>
          )}
        </div>
      </Card>

      {/* AI 채널별 변환 */}
      <AiAdaptPanel
        sourceText={body}
        channels={aiChannels}
        subreddit={reddit.subreddit}
        onApply={applyAiResult}
      />

      {/* Reddit 입력 */}
      {selected.reddit && connectedChannels.reddit && (
        <Card className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Reddit</p>
            {flairSubreddit ? (
              <span className="text-xs text-muted-foreground">
                r/{flairSubreddit}
              </span>
            ) : null}
          </div>

          {(channelContents.reddit ?? "").trim().length > 0 && (
            <p className="text-xs text-muted-foreground">
              AI 맞춤 본문 사용 중 — 본문란 대신 발행
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reddit-subreddit">서브레딧</Label>
              <Input
                id="reddit-subreddit"
                value={reddit.subreddit}
                onChange={(e) => updateReddit({ subreddit: e.target.value })}
                placeholder="예: iosdev (r/ 제외)"
              />
              {reddit.subreddit.trim() && !isValidSubreddit(reddit.subreddit) && (
                <p className="text-xs text-destructive">
                  영문·숫자·밑줄 2~21자로 입력
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reddit-flair">플레어 (선택)</Label>
              <select
                id="reddit-flair"
                value={reddit.flairId}
                onChange={(e) => updateReddit({ flairId: e.target.value })}
                disabled={flairs.length === 0}
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">플레어 없음</option>
                {flairs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.text}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {flairsLoading
                  ? "플레어 불러오는 중..."
                  : !isValidSubreddit(reddit.subreddit)
                  ? "서브레딧 입력 후 선택 가능"
                  : flairs.length > 0
                  ? `사용 가능한 플레어 ${flairs.length}개`
                  : "사용 가능한 플레어 없음"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="reddit-title">제목</Label>
              <span
                className={
                  reddit.title.length > REDDIT_TITLE_MAX
                    ? "text-xs text-destructive"
                    : "text-xs text-muted-foreground"
                }
              >
                {reddit.title.length} / {REDDIT_TITLE_MAX}
              </span>
            </div>
            <Input
              id="reddit-title"
              value={reddit.title}
              onChange={(e) => updateReddit({ title: e.target.value })}
              placeholder="예: 사이드 프로젝트로 만든 iOS 앱 후기"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reddit-link">링크 (선택)</Label>
            <Input
              id="reddit-link"
              value={reddit.link}
              onChange={(e) => updateReddit({ link: e.target.value })}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              링크 입력 시 링크 글 · 비우면 본문으로 텍스트 글
            </p>
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
              {r.permalink && (
                <a
                  href={r.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-primary hover:underline"
                >
                  게시물 열기
                </a>
              )}
              {r.error && <p className="mt-1 text-xs">{r.error}</p>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
