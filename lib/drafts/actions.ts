"use server";

import { requireUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import type { Channel, InstagramCard } from "@/app/(app)/compose/actions";

export type DraftData = {
  body: string;
  instagramCards: InstagramCard[];
  instagramTemplate: string;
  selectedChannels: Channel[];
  updatedAt?: string | null;
};

type SaveDraftInput = {
  body: string;
  instagramCards: InstagramCard[];
  instagramTemplate: string;
  selectedChannels: Channel[];
};

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
      "body, instagram_cards, instagram_template, selected_channels, updated_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    body: data.body ?? "",
    instagramCards: (data.instagram_cards as InstagramCard[]) ?? [],
    instagramTemplate: data.instagram_template ?? "minimal-white",
    selectedChannels: (data.selected_channels as Channel[]) ?? [],
    updatedAt: data.updated_at ?? null,
  };
}

export async function deleteDraft(): Promise<void> {
  const user = await requireUser();
  const supabase = createClient();

  await supabase.from("drafts").delete().eq("user_id", user.id);
}
