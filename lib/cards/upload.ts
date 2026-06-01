import { createClient as createServiceClient } from "@supabase/supabase-js";

export const BUCKET = "cards";

/**
 * Upload generated card images (JPEG) to Supabase Storage and return public URLs.
 *
 * Uses the service_role key to bypass RLS on the storage bucket — the bucket
 * must be created as `public` so the returned URLs are accessible to Instagram's
 * CDN crawler.
 */
export async function uploadCardImages(
  userId: string,
  images: Buffer[]
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
  for (let i = 0; i < images.length; i++) {
    const path = `${userId}/${ts}-${i}.jpg`;
    const { error } = await admin.storage.from(BUCKET).upload(path, images[i], {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw new Error(`Card upload failed: ${error.message}`);

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    urls.push(pub.publicUrl);
  }
  return urls;
}

export const BACKGROUND_MAX_BYTES = 8 * 1024 * 1024; // 8MB

export const BACKGROUND_ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp"] as const;

/**
 * Issue a signed upload URL so the client can upload a background image
 * directly to Supabase Storage, bypassing the Vercel serverless body limit.
 *
 * The service_role key signs a one-time upload token for a deterministic path
 * (`${userId}/bg-${ts}.<ext>`) in the public `cards` bucket. The client uploads
 * the file with `uploadToSignedUrl(path, token, file)`; no service_role key or
 * bucket RLS change is needed on the client.
 */
export async function createBackgroundUploadUrl(
  userId: string,
  fileExt: string
): Promise<{ path: string; token: string; publicUrl: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase env for storage upload");
  }
  const admin = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const path = `${userId}/bg-${Date.now()}.${fileExt}`;

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Background upload URL failed: ${error?.message ?? "unknown"}`);
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { path: data.path, token: data.token, publicUrl: pub.publicUrl };
}
