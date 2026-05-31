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

export const BACKGROUND_MAX_BYTES = 8 * 1024 * 1024; // 8MB

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Upload a user-provided background image to Supabase Storage and return its
 * public URL. Reuses the same public `cards` bucket as the generated PNGs.
 *
 * Validates MIME type (image/*) and size (<= 8MB) before upload. Files live
 * under `${userId}/bg-${ts}.<ext>` so they never collide with card PNGs.
 */
export async function uploadBackgroundImage(
  userId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드 가능합니다.");
  }
  if (file.size > BACKGROUND_MAX_BYTES) {
    throw new Error("이미지 용량은 8MB 이하만 가능합니다.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase env for storage upload");
  }
  const admin = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const ext = EXT_BY_TYPE[file.type] ?? "img";
  const path = `${userId}/bg-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw new Error(`Background upload failed: ${error.message}`);

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}
