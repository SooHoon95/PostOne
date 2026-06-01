import { encode } from "jpeg-js";

export const CARD_JPEG_QUALITY = 82;

// resvg가 렌더한 raw RGBA 픽셀을 JPEG로 인코딩한다 (순수 JS — 네이티브 빌드 불필요,
// Vercel·OCI ARM 어디서나 동작). 카드는 1080² 불투명 이미지라 알파 손실 없음.
// PNG(사진 배경 ~1.5MB) → JPEG(~200KB): 스토리지 5~10배 절감 + 인스타그램 호환.
export function rgbaToJpeg(
  rgba: Buffer,
  width: number,
  height: number,
  quality: number = CARD_JPEG_QUALITY
): Buffer {
  return encode({ data: rgba, width, height }, quality).data;
}
