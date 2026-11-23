"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useExtensionBridge } from "@/lib/hooks/use-peerlist-extension";
import {
  CHANNEL_LIMITS,
  type AdaptedChannelContent,
  type AIChannel,
  type AILanguage,
  type InstagramAdapt,
} from "@/lib/ai/types";

/** 발행 가능한 4채널(+ Peerlist 초안은 3단계 크롬 익스텐션용) */
export type PublishChannel = "linkedin" | "threads" | "instagram" | "reddit";

export type AiApplyPayload = {
  channelContents: Partial<Record<PublishChannel, string>>;
  instagram: {
    cardTitle: string;
    slides: { title: string; description: string }[];
  } | null;
  redditTitle: string | null;
};

const LABEL: Record<AIChannel, string> = {
  linkedin: "LinkedIn",
  threads: "Threads",
  instagram: "Instagram",
  reddit: "Reddit",
  peerlist: "Peerlist",
};

const ACCENT: Record<AIChannel, string> = {
  linkedin: "text-channel-linkedin",
  threads: "text-channel-threads",
  instagram: "text-channel-instagram",
  reddit: "text-channel-reddit",
  peerlist: "text-channel-peerlist",
};

const LANGUAGE_OPTION: { value: AILanguage; label: string }[] = [
  { value: "auto", label: "원문 언어" },
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
];

type AdaptResponse = {
  provider: "anthropic" | "openai";
  model: string;
  channels: Partial<AdaptedChannelContent>;
  warnings?: string[];
};

type Draft = Partial<AdaptedChannelContent>;

function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span
      className={cn(
        "text-xs",
        length > max ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {length} / {max}
    </span>
  );
}

export function AiAdaptPanel({
  sourceText,
  channels,
  subreddit,
  redditConnected,
  onApply,
}: {
  sourceText: string;
  channels: AIChannel[];
  subreddit?: string;
  /** Reddit OAuth 연결 여부 — 미연결이면 확장 전송으로 안내한다. */
  redditConnected?: boolean;
  onApply: (payload: AiApplyPayload) => void;
}) {
  const [language, setLanguage] = useState<AILanguage>("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [meta, setMeta] = useState<{ provider: string; model: string } | null>(
    null
  );
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);
  const extension = useExtensionBridge();
  const [peerlistSent, setPeerlistSent] = useState<
    "idle" | "sending" | "sent"
  >("idle");
  const [peerlistNotice, setPeerlistNotice] = useState<string | null>(null);
  const [redditSent, setRedditSent] = useState<"idle" | "sending" | "sent">(
    "idle"
  );
  const [redditNotice, setRedditNotice] = useState<string | null>(null);
  const [redditCopied, setRedditCopied] = useState(false);

  const canRun = sourceText.trim().length > 0 && channels.length > 0;
  const extensionLabel =
    extension.state === "ready"
      ? "확장 연결됨"
      : extension.state === "checking"
        ? "확장 확인 중"
        : "확장 미설치 — 복사로 대체";

  async function run() {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    setApplied(false);
    setCopied(false);
    try {
      const res = await fetch("/api/ai/adapt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceText,
          channels,
          subreddit: subreddit?.trim() || undefined,
          language,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | (AdaptResponse & { message?: string })
        | null;

      if (!res.ok) {
        setDraft(null);
        setMeta(null);
        setWarnings([]);
        setError(data?.message ?? "AI 변환에 실패했습니다.");
        return;
      }
      if (!data || typeof data !== "object" || !data.channels) {
        setDraft(null);
        setError("AI 변환 결과를 읽지 못했습니다.");
        return;
      }
      setDraft(data.channels);
      setMeta({ provider: data.provider, model: data.model });
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    } catch {
      setDraft(null);
      setMeta(null);
      setError("AI 변환 요청에 실패했습니다. 네트워크 연결 확인 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  function setText(
    channel: "linkedin" | "threads" | "peerlist",
    content: string
  ) {
    setDraft((prev) => (prev ? { ...prev, [channel]: { content } } : prev));
  }

  function setInstagram(patch: Partial<InstagramAdapt>) {
    setDraft((prev) =>
      prev?.instagram
        ? { ...prev, instagram: { ...prev.instagram, ...patch } }
        : prev
    );
  }

  function setSlide(
    index: number,
    patch: Partial<{ title: string; description: string }>
  ) {
    setDraft((prev) => {
      if (!prev?.instagram) return prev;
      const slides = prev.instagram.slides.map((slide, i) =>
        i === index ? { ...slide, ...patch } : slide
      );
      return { ...prev, instagram: { ...prev.instagram, slides } };
    });
  }

  function setReddit(patch: Partial<{ title: string; content: string }>) {
    setDraft((prev) =>
      prev?.reddit ? { ...prev, reddit: { ...prev.reddit, ...patch } } : prev
    );
  }

  function apply() {
    if (!draft) return;
    const channelContents: Partial<Record<PublishChannel, string>> = {};
    if (draft.linkedin) channelContents.linkedin = draft.linkedin.content;
    if (draft.threads) channelContents.threads = draft.threads.content;
    if (draft.reddit) channelContents.reddit = draft.reddit.content;
    if (draft.instagram) channelContents.instagram = draft.instagram.caption;

    onApply({
      channelContents,
      instagram: draft.instagram
        ? {
            cardTitle: draft.instagram.cardTitle,
            slides: draft.instagram.slides,
          }
        : null,
      redditTitle: draft.reddit?.title ?? null,
    });
    setApplied(true);
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setError("클립보드를 사용할 수 없습니다. 본문을 직접 선택해 복사해주세요.");
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      setError("복사에 실패했습니다. 본문을 직접 선택해 복사해주세요.");
      return false;
    }
  }

  async function copyPeerlist(text: string) {
    await copyToClipboard(text);
  }

  function resetPeerlistSendState() {
    setPeerlistSent("idle");
    setPeerlistNotice(null);
  }

  /**
   * 익스텐션이 설치돼 있으면 초안을 chrome.storage로 보내고, 없으면
   * 클립보드 복사로 대체한다(설치 안내는 문구로).
   */
  async function sendPeerlist(text: string) {
    if (!text.trim()) return;
    setPeerlistSent("sending");
    setPeerlistNotice(null);
    const result = await extension.sendDraft(text);
    if (result.ok) {
      setPeerlistSent("sent");
      setPeerlistNotice(
        "확장에 저장됨 — 툴바 PostOne 아이콘에서 '작성창에 채우기'"
      );
      return;
    }
    setPeerlistSent("idle");
    const copiedNow = await copyToClipboard(text);
    setPeerlistNotice(
      copiedNow
        ? "확장 미연결 — 초안을 복사했습니다. Peerlist에 붙여넣어 주세요."
        : "확장 미연결, 복사도 실패 — 본문을 직접 선택해 복사해 주세요."
    );
  }

  function resetRedditSendState() {
    setRedditSent("idle");
    setRedditNotice(null);
  }

  /**
   * Reddit OAuth 가 막혀 있어도 확장이 reddit.com 글쓰기 창을 채울 수 있도록
   * 제목·본문·서브레딧 힌트를 넘긴다. 미설치면 제목+본문 복사로 대체.
   */
  async function sendReddit(title: string, body: string) {
    if (!title.trim() || !body.trim()) return;
    setRedditSent("sending");
    setRedditNotice(null);
    const result = await extension.sendRedditDraft({
      subreddit: subreddit?.trim() || undefined,
      title,
      body,
    });
    if (result.ok) {
      setRedditSent("sent");
      setRedditNotice(
        "확장에 저장됨 — 툴바 PostOne 아이콘에서 'Reddit 작성창에 채우기'"
      );
      return;
    }
    setRedditSent("idle");
    const copiedNow = await copyToClipboard(`${title.trim()}\n\n${body.trim()}`);
    setRedditNotice(
      copiedNow
        ? "확장 미연결 — 제목·본문을 복사했습니다. reddit.com/submit에 붙여넣어 주세요."
        : "확장 미연결, 복사도 실패 — 본문을 직접 선택해 복사해 주세요."
    );
  }

  async function copyReddit(title: string, body: string) {
    const ok = await copyToClipboard(`${title.trim()}\n\n${body.trim()}`);
    if (ok) {
      setRedditCopied(true);
      window.setTimeout(() => setRedditCopied(false), 2000);
    }
  }

  function renderBlock(channel: AIChannel) {
    if (channel === "linkedin" && draft?.linkedin) {
      return (
        <div key={channel} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <p className={cn("text-xs font-medium", ACCENT[channel])}>LinkedIn</p>
            <Counter
              length={draft.linkedin.content.length}
              max={CHANNEL_LIMITS.linkedin.content}
            />
          </div>
          <Textarea
            aria-label="LinkedIn 변환 본문"
            value={draft.linkedin.content}
            rows={8}
            onChange={(e) => setText("linkedin", e.target.value)}
          />
        </div>
      );
    }

    if (channel === "threads" && draft?.threads) {
      return (
        <div key={channel} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <p className={cn("text-xs font-medium", ACCENT[channel])}>Threads</p>
            <Counter
              length={draft.threads.content.length}
              max={CHANNEL_LIMITS.threads.content}
            />
          </div>
          <Textarea
            aria-label="Threads 변환 본문"
            value={draft.threads.content}
            rows={5}
            onChange={(e) => setText("threads", e.target.value)}
          />
        </div>
      );
    }

    if (channel === "instagram" && draft?.instagram) {
      const ig = draft.instagram;
      return (
        <div key={channel} className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <p className={cn("text-xs font-medium", ACCENT[channel])}>Instagram</p>
            <Counter
              length={ig.caption.length}
              max={CHANNEL_LIMITS.instagram.caption}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">캡션</p>
            <Textarea
              aria-label="Instagram 캡션"
              value={ig.caption}
              rows={6}
              onChange={(e) => setInstagram({ caption: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                카드 표지 제목 (1번 카드 제목이 비었을 때 사용)
              </p>
              <Counter
                length={ig.cardTitle.length}
                max={CHANNEL_LIMITS.instagram.cardTitle}
              />
            </div>
            <Input
              aria-label="Instagram 카드 제목"
              value={ig.cardTitle}
              onChange={(e) => setInstagram({ cardTitle: e.target.value })}
              placeholder="카드뉴스 표지 제목"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              슬라이드 {ig.slides.length}장
            </p>
            {ig.slides.length === 0 && (
              <p className="text-xs text-muted-foreground">
                슬라이드 없음 — 적용 후 카드 직접 추가
              </p>
            )}
            {ig.slides.map((slide, i) => (
              <div key={i} className="space-y-1 rounded-md bg-muted p-2">
                <Input
                  aria-label={`${i + 1}번째 슬라이드 제목`}
                  value={slide.title}
                  onChange={(e) => setSlide(i, { title: e.target.value })}
                  placeholder={`${i + 1}번째 카드 제목`}
                />
                <Textarea
                  aria-label={`${i + 1}번째 슬라이드 설명`}
                  value={slide.description}
                  rows={3}
                  onChange={(e) => setSlide(i, { description: e.target.value })}
                  placeholder="카드 설명"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (channel === "reddit" && draft?.reddit) {
      const reddit = draft.reddit;
      return (
        <div key={channel} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className={cn("text-xs font-medium", ACCENT[channel])}>Reddit</p>
              {redditConnected === false && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  OAuth 미연결
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Counter
                length={reddit.content.length}
                max={CHANNEL_LIMITS.reddit.content}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void sendReddit(reddit.title, reddit.content)}
                disabled={redditSent === "sending" || !reddit.title.trim()}
              >
                {redditSent === "sending"
                  ? "전송 중..."
                  : redditSent === "sent"
                    ? "확장으로 전송됨"
                    : "Reddit 확장으로 전송"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyReddit(reddit.title, reddit.content)}
              >
                {redditCopied ? "복사됨" : "Reddit 초안 복사"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">제목</p>
            <Counter
              length={reddit.title.length}
              max={CHANNEL_LIMITS.reddit.title}
            />
          </div>
          <Input
            aria-label="Reddit 변환 제목"
            value={reddit.title}
            onChange={(e) => {
              setReddit({ title: e.target.value });
              resetRedditSendState();
            }}
          />
          <Textarea
            aria-label="Reddit 변환 본문"
            value={reddit.content}
            rows={8}
            onChange={(e) => {
              setReddit({ content: e.target.value });
              resetRedditSendState();
            }}
          />
          <p className="text-xs text-muted-foreground" role="status">
            {redditNotice ??
              (redditConnected === false
                ? `${extensionLabel} · OAuth 미연결 — 확장으로 reddit.com 글쓰기 창에 채운 뒤 직접 게시`
                : `${extensionLabel} · 확장 설치 후 작성창에 한 번에 채우기`)}
          </p>
        </div>
      );
    }

    if (channel === "peerlist" && draft?.peerlist) {
      const peerlist = draft.peerlist;
      return (
        <div key={channel} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn("text-xs font-medium", ACCENT[channel])}>Peerlist</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void sendPeerlist(peerlist.content)}
                disabled={peerlistSent === "sending"}
              >
                {peerlistSent === "sending"
                  ? "전송 중..."
                  : peerlistSent === "sent"
                    ? "확장으로 전송됨"
                    : "Peerlist 확장으로 전송"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyPeerlist(peerlist.content)}
              >
                {copied ? "복사됨" : "Peerlist 초안 복사"}
              </Button>
            </div>
          </div>
          <Textarea
            aria-label="Peerlist 초안"
            value={peerlist.content}
            rows={5}
            onChange={(e) => {
              setText("peerlist", e.target.value);
              resetPeerlistSendState();
            }}
          />
          <p className="text-xs text-muted-foreground" role="status">
            {peerlistNotice ??
              `${extensionLabel} · 크롬 익스텐션 설치 후 작성창에 한 번에 채우기`}
          </p>
        </div>
      );
    }

    return null;
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">AI 채널별 변환</p>
          <p className="mt-1 text-xs text-muted-foreground">
            한 번 쓴 초안을 5개 채널 톤·형식에 맞게 재작성
          </p>
        </div>
        <div className="flex items-end gap-2">
          <select
            aria-label="변환 언어"
            value={language}
            onChange={(e) => setLanguage(e.target.value as AILanguage)}
            className="h-9 rounded-md border border-input bg-card px-2 text-sm"
          >
            {LANGUAGE_OPTION.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={() => void run()} disabled={!canRun || loading}>
            {loading ? "변환 중..." : "AI 변환"}
          </Button>
        </div>
      </div>

      {!canRun && (
        <p className="text-xs text-muted-foreground">
          본문 작성 후 사용 가능
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {draft && (
        <div className="space-y-3">
          {meta && (
            <p className="text-xs text-muted-foreground">
              {meta.provider === "anthropic" ? "Claude" : "OpenAI"} · {meta.model}
            </p>
          )}
          {channels.map((channel) => renderBlock(channel))}
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={apply}>
              전체 적용
            </Button>
            {applied && <span className="text-xs text-success">적용됨</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
