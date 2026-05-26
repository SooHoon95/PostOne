import { describe, it, expect } from "vitest";
import { splitToSlides } from "@/lib/cards/text-split";

describe("splitToSlides", () => {
  it("returns empty for empty input", () => {
    expect(splitToSlides("")).toEqual([]);
    expect(splitToSlides("   ")).toEqual([]);
  });

  it("returns 1 slide for short text without title", () => {
    const slides = splitToSlides("Hello world");
    expect(slides).toHaveLength(1);
    expect(slides[0].body).toBe("Hello world");
    expect(slides[0].total).toBe(1);
  });

  it("adds intro slide when title given", () => {
    const slides = splitToSlides("Body text here", "My Title");
    expect(slides).toHaveLength(1);
    expect(slides[0].title).toBe("My Title");
    expect(slides[0].body).toBe("Body text here");
  });

  it("splits paragraphs into multiple slides", () => {
    const text = "Para 1.\n\nPara 2.\n\nPara 3.";
    const slides = splitToSlides(text);
    expect(slides).toHaveLength(3);
    expect(slides.map((s) => s.body)).toEqual(["Para 1.", "Para 2.", "Para 3."]);
  });

  it("splits long paragraph by sentences within limit", () => {
    // 5 short sentences, each ~50 chars → should fit in 1-2 slides
    const text = Array(5)
      .fill("This is a short sentence with about fifty characters here.")
      .join(" ");
    const slides = splitToSlides(text);
    expect(slides.length).toBeGreaterThan(1);
    expect(slides.every((s) => s.body.length <= 220)).toBe(true);
  });

  it("caps at 10 slides", () => {
    const text = Array(50).fill("Para.").join("\n\n");
    const slides = splitToSlides(text);
    expect(slides.length).toBeLessThanOrEqual(10);
  });

  it("hard chunks if a sentence exceeds limit", () => {
    const longSentence = "가".repeat(300);
    const slides = splitToSlides(longSentence);
    expect(slides.length).toBeGreaterThanOrEqual(2);
    expect(slides.every((s) => s.body.length <= 220)).toBe(true);
  });

  it("sets index and total correctly", () => {
    const slides = splitToSlides("A.\n\nB.\n\nC.");
    expect(slides.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(slides.every((s) => s.total === 3)).toBe(true);
  });
});
