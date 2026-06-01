import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadFonts } from "./font";
import { renderSlide, type TemplateName } from "./templates";
import type { Slide } from "./text-split";
import { rgbaToJpeg } from "./encode";

const SIZE = 1080;

export async function renderSlideToImage(
  slide: Slide,
  template: TemplateName
): Promise<Buffer> {
  const fonts = await loadFonts();

  const svg = await satori(renderSlide(slide, template), {
    width: SIZE,
    height: SIZE,
    fonts: [
      {
        name: "Pretendard",
        data: fonts.regular,
        weight: 400,
        style: "normal",
      },
      {
        name: "Pretendard",
        data: fonts.bold,
        weight: 700,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: SIZE },
  });
  const rendered = resvg.render();
  // raw RGBA → JPEG 직행 (PNG 왕복 없음): 스토리지 절감 + 인스타그램 호환.
  return rgbaToJpeg(Buffer.from(rendered.pixels), rendered.width, rendered.height);
}

export async function renderSlidesToImages(
  slides: Slide[],
  template: TemplateName
): Promise<Buffer[]> {
  return Promise.all(slides.map((s) => renderSlideToImage(s, template)));
}
