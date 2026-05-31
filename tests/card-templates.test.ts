import { describe, it, expect } from "vitest";
import { renderSlide, type TemplateName } from "../lib/cards/templates";
import type { Slide } from "../lib/cards/text-split";

/**
 * Satori (0.26) crashes with "Cannot read properties of undefined (reading
 * 'toString')" when a style property value is `undefined` — its per-property
 * handlers do `value.toString().trim()`. React tolerates undefined style
 * values; Satori does not. So our card templates must NEVER emit a style key
 * whose value is `undefined`.
 *
 * Regression: commit 9e15bf2 added `textShadow: hasBg ? "..." : undefined` to
 * the default `minimal-white` template, breaking every card without a
 * background image (the common case).
 *
 * `renderSlide` returns a wrapper component element, so we must expand function
 * components down to the host (div/img) tree that Satori actually processes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function undefinedStyleKeys(node: any, path = "root"): string[] {
  if (!node || typeof node !== "object") return [];
  // Function component → render it and inspect its output.
  if (typeof node.type === "function") {
    return undefinedStyleKeys(node.type(node.props ?? {}), path);
  }
  const props = node.props ?? {};
  const out: string[] = [];
  const style = props.style;
  if (style && typeof style === "object") {
    for (const [k, v] of Object.entries(style)) {
      if (v === undefined) out.push(`${path}.style.${k}`);
    }
  }
  const children = props.children;
  const arr = Array.isArray(children) ? children : children == null ? [] : [children];
  arr.forEach((c, i) => out.push(...undefinedStyleKeys(c, `${path}>${i}`)));
  return out;
}

const TEMPLATES: TemplateName[] = ["minimal-white", "gradient", "photo-overlay"];

const VARIANTS: { name: string; slide: Slide }[] = [
  { name: "no title / no bg", slide: { index: 0, total: 1, body: "본문" } },
  { name: "title / no bg", slide: { index: 0, total: 2, title: "제목", body: "본문" } },
  {
    name: "title / bg",
    slide: { index: 0, total: 2, title: "제목", body: "본문", backgroundImageUrl: "https://example/x.png" },
  },
];

describe("card templates emit no undefined style values (Satori crash guard)", () => {
  for (const t of TEMPLATES) {
    for (const v of VARIANTS) {
      it(`${t} — ${v.name}`, () => {
        expect(undefinedStyleKeys(renderSlide(v.slide, t))).toEqual([]);
      });
    }
  }
});
