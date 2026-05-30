"use client";

export function CharacterCounter({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const over = value > max;
  return (
    <p className={`text-xs ${over ? "text-red-600" : "text-muted-foreground"}`}>
      {value} / {max}
    </p>
  );
}
