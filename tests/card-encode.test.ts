import { describe, it, expect } from "vitest";
import { rgbaToJpeg } from "../lib/cards/encode";

describe("card image encoding (rgbaToJpeg)", () => {
  it("encodes raw RGBA into a valid, compact JPEG", () => {
    const W = 1080;
    const H = 1080;
    const rgba = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        rgba[i] = Math.floor((x * 255) / W);
        rgba[i + 1] = Math.floor((y * 255) / H);
        rgba[i + 2] = Math.floor(((x + y) * 255) / (W + H));
        rgba[i + 3] = 255;
      }
    }

    const jpeg = rgbaToJpeg(rgba, W, H);

    // JPEG SOI magic bytes
    expect(jpeg[0]).toBe(0xff);
    expect(jpeg[1]).toBe(0xd8);
    // JPEG must be far smaller than the raw RGBA source (W*H*4 bytes)
    expect(jpeg.length).toBeLessThan(rgba.length / 4);
  });
});
