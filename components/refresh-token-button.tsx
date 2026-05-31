"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Channel } from "@/components/channel-badge";
import { refreshConnection } from "@/lib/connections/refresh";

export function RefreshTokenButton({ channel }: { channel: Channel }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await refreshConnection(channel);
      if (!res.ok) setError(res.error ?? "갱신 실패");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? "갱신 중..." : "토큰 갱신"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
