import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadFonts } from "./font";
import { renderSlide, type TemplateName } from "./templates";
import type { Slide } from "./text-split";

const SIZE = 1080;

export async function renderSlideToPng(
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
  const png = resvg.render().asPng();
  return Buffer.from(png);
}

export async function renderSlidesToPngs(
  slides: Slide[],
  template: TemplateName
): Promise<Buffer[]> {
  return Promise.all(slides.map((s) => renderSlideToPng(s, template)));
}
