import { createClient as createServiceClient } from "@supabase/supabase-js";

const BUCKET = "cards";

/**
 * Upload PNG buffers to Supabase Storage and return public URLs.
 *
 * Uses the service_role key to bypass RLS on the storage bucket — the bucket
 * must be created as `public` so the returned URLs are accessible to Instagram's
 * CDN crawler.
 */
export async function uploadCardPngs(
  userId: string,
  pngs: Buffer[]
): Promise<string[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase env for storage upload");
  }
  const admin = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const ts = Date.now();
  const urls: string[] = [];
  for (let i = 0; i < pngs.length; i++) {
    const path = `${userId}/${ts}-${i}.png`;
    const { error } = await admin.storage.from(BUCKET).upload(path, pngs[i], {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw new Error(`Card upload failed: ${error.message}`);

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    urls.push(pub.publicUrl);
  }
  return urls;
}
