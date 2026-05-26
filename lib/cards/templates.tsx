import * as React from "react";
import type { Slide } from "./text-split";

export type TemplateName = "minimal-white" | "gradient" | "photo-overlay";

const SIZE = 1080; // Instagram square

export function renderSlide(
  slide: Slide,
  template: TemplateName
): React.ReactElement {
  switch (template) {
    case "minimal-white":
      return <MinimalWhite slide={slide} />;
    case "gradient":
      return <Gradient slide={slide} />;
    case "photo-overlay":
      return <PhotoOverlay slide={slide} />;
  }
}

function PageNumber({ slide }: { slide: Slide }) {
  if (slide.total <= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        right: 60,
        fontSize: 28,
        fontWeight: 700,
        color: "rgba(0,0,0,0.45)",
      }}
    >
      {slide.index + 1} / {slide.total}
    </div>
  );
}

function MinimalWhite({ slide }: { slide: Slide }) {
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        display: "flex",
        flexDirection: "column",
        justifyContent: slide.title ? "center" : "flex-start",
        padding: 80,
        background: "#ffffff",
        fontFamily: "Pretendard",
        position: "relative",
      }}
    >
      {slide.title && (
        <div
          style={{
            fontSize: 84,
            fontWeight: 700,
            color: "#0f172a",
            lineHeight: 1.15,
            marginBottom: 40,
          }}
        >
          {slide.title}
        </div>
      )}
      <div
        style={{
          fontSize: slide.title ? 42 : 56,
          fontWeight: 400,
          color: slide.title ? "#334155" : "#0f172a",
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
        }}
      >
        {slide.body}
      </div>
      <PageNumber slide={slide} />
    </div>
  );
}

function Gradient({ slide }: { slide: Slide }) {
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background:
          "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
        fontFamily: "Pretendard",
        position: "relative",
      }}
    >
      {slide.title && (
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
            marginBottom: 50,
            textShadow: "0 4px 24px rgba(0,0,0,0.25)",
          }}
        >
          {slide.title}
        </div>
      )}
      <div
        style={{
          fontSize: slide.title ? 44 : 56,
          fontWeight: slide.title ? 400 : 700,
          color: "#ffffff",
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
        }}
      >
        {slide.body}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 60,
          fontSize: 28,
          fontWeight: 700,
          color: "rgba(255,255,255,0.75)",
        }}
      >
        {slide.total > 1 ? `${slide.index + 1} / ${slide.total}` : ""}
      </div>
    </div>
  );
}

function PhotoOverlay({ slide }: { slide: Slide }) {
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: 80,
        background: "#0f172a",
        fontFamily: "Pretendard",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 80,
          fontSize: 32,
          fontWeight: 700,
          color: "#94a3b8",
          letterSpacing: "0.1em",
        }}
      >
        ONEPOST
      </div>
      {slide.title && (
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: "#f8fafc",
            lineHeight: 1.1,
            marginBottom: 40,
          }}
        >
          {slide.title}
        </div>
      )}
      <div
        style={{
          fontSize: slide.title ? 44 : 56,
          fontWeight: 400,
          color: "#e2e8f0",
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
        }}
      >
        {slide.body}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 60,
          fontSize: 28,
          fontWeight: 700,
          color: "#64748b",
        }}
      >
        {slide.total > 1 ? `${slide.index + 1} / ${slide.total}` : ""}
      </div>
    </div>
  );
}
