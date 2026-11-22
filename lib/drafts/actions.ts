"use server";

import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import type { Channel, InstagramCard } from "@/app/(app)/compose/actions";

/** Reddit 전용 입력 — 채널별 본문과 별개로 임시저장한다. */
export type DraftReddit = {
  subreddit: string;
  title: string;
  link: string;
  flairId: string;
};

export type DraftData = {
  body: string;
  instagramCards: InstagramCard[];
  instagramTemplate: string;
  selectedChannels: Channel[];
  reddit: DraftReddit;
  updatedAt?: string | null;
};

type SaveDraftInput = {
  body: string;
  instagramCards: InstagramCard[];
  instagramTemplate: string;
  selectedChannels: Channel[];
  reddit?: DraftReddit;
};

function toDraftReddit(value: unknown): DraftReddit {
  const v = (value ?? {}) as Partial<DraftReddit>;
  return {
    subreddit: typeof v.subreddit === "string" ? v.subreddit : "",
    title: typeof v.title === "string" ? v.title : "",
    link: typeof v.link === "string" ? v.link : "",
    flairId: typeof v.flairId === "string" ? v.flairId : "",
  };
}

export async function saveDraft(input: SaveDraftInput): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const supabase = createClient();

  const { error } = await supabase.from("drafts").upsert(
    {
      user_id: user.id,
      body: input.body,
      instagram_cards: input.instagramCards,
      instagram_template: input.instagramTemplate,
      selected_channels: input.selectedChannels,
      reddit: input.reddit ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return { ok: !error };
}

export async function loadDraft(): Promise<DraftData | null> {
  const user = await requireUser();
  const supabase = createClient();

  const { data } = await supabase
    .from("drafts")
    .select(
      "body, instagram_cards, instagram_template, selected_channels, reddit, updated_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    body: data.body ?? "",
    instagramCards: (data.instagram_cards as InstagramCard[]) ?? [],
    instagramTemplate: data.instagram_template ?? "minimal-white",
    selectedChannels: (data.selected_channels as Channel[]) ?? [],
    reddit: toDraftReddit(data.reddit),
    updatedAt: data.updated_at ?? null,
  };
}

export async function deleteDraft(): Promise<void> {
  const user = await requireUser();
  const supabase = createClient();

  await supabase.from("drafts").delete().eq("user_id", user.id);
}
