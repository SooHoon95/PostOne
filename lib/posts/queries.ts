import { createClient } from "@/lib/supabase/server";
import type { Post } from "@/lib/supabase/types";

export async function getRecentPosts(
  userId: string,
  limit = 30
): Promise<Post[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as Post[];
}

export async function getRecentPostsByChannel(
  userId: string,
  channel: string,
  limit = 30
): Promise<Post[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as Post[];
}
