/**
 * Split text into carousel slides.
 *
 * Strategy:
 * - Slide 1 (intro): first paragraph or first sentence as hook
 * - Body slides: split remaining text by paragraphs, then by char limit
 * - Final slide (CTA): caller-provided or auto "더 보기"
 * - Max slides: 10 (Instagram carousel limit)
 */
const SLIDE_CHAR_LIMIT = 220;
const MAX_SLIDES = 10;

export type Slide = {
  index: number;
  total: number;
  title?: string; // shown on first slide
  body: string;
};

export function splitToSlides(input: string, title?: string): Slide[] {
  const text = input.trim();
  if (!text) return [];

  const paragraphs = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= SLIDE_CHAR_LIMIT) {
      chunks.push(para);
      continue;
    }
    // Split paragraph by sentence boundary, fill chunks up to limit
    const sentences = para.split(/(?<=[.!?。！？])\s+/);
    let buf = "";
    for (const s of sentences) {
      if ((buf + " " + s).trim().length <= SLIDE_CHAR_LIMIT) {
        buf = (buf + " " + s).trim();
      } else {
        if (buf) chunks.push(buf);
        // sentence itself longer than limit → hard chunk
        if (s.length > SLIDE_CHAR_LIMIT) {
          for (let i = 0; i < s.length; i += SLIDE_CHAR_LIMIT) {
            chunks.push(s.slice(i, i + SLIDE_CHAR_LIMIT));
          }
          buf = "";
        } else {
          buf = s;
        }
      }
    }
    if (buf) chunks.push(buf);
  }

  // Cap to MAX_SLIDES (reserve 1 for title intro if title present)
  const reservedForTitle = title ? 1 : 0;
  const bodyChunks = chunks.slice(0, MAX_SLIDES - reservedForTitle);

  const slides: Slide[] = [];
  let idx = 0;
  const total = bodyChunks.length + reservedForTitle;

  if (title) {
    slides.push({ index: idx++, total, title, body: bodyChunks[0] ?? "" });
    for (let i = 1; i < bodyChunks.length; i++) {
      slides.push({ index: idx++, total, body: bodyChunks[i] });
    }
  } else {
    for (const c of bodyChunks) {
      slides.push({ index: idx++, total, body: c });
    }
  }

  return slides;
}
