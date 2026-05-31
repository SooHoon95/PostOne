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

export async function getPostById(
  userId: string,
  id: string
): Promise<Post | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Post;
}

export async function getPostsByBatch(
  userId: string,
  batchId: string
): Promise<Post[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as Post[];
}
