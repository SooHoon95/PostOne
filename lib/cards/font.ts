/**
 * Load Korean font for Satori rendering.
 * Fetched once at module load and cached in memory.
 *
 * Uses Pretendard (open source, OFL license) via jsdelivr CDN.
 */
// Satori requires TTF/OTF (NOT WOFF/WOFF2)
const FONT_URLS = {
  regular:
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf",
  bold: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf",
};

let cached: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

export async function loadFonts(): Promise<{
  regular: ArrayBuffer;
  bold: ArrayBuffer;
}> {
  if (cached) return cached;

  const [regularRes, boldRes] = await Promise.all([
    fetch(FONT_URLS.regular),
    fetch(FONT_URLS.bold),
  ]);
  if (!regularRes.ok || !boldRes.ok) {
    throw new Error("Failed to fetch Pretendard fonts");
  }
  const [regular, bold] = await Promise.all([
    regularRes.arrayBuffer(),
    boldRes.arrayBuffer(),
  ]);
  cached = { regular, bold };
  return cached;
}
