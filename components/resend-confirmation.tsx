"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resendConfirmation } from "@/lib/auth/actions";

type Status = "idle" | "sending" | "sent" | "error";

const COOLDOWN_SEC = 60;

export function ResendConfirmation({ email: initialEmail }: { email: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onResend() {
    if (!email || cooldown > 0 || status === "sending") return;
    setStatus("sending");
    setError(null);
    const r = await resendConfirmation({ email: email.trim() });
    if (r.error) {
      setStatus("error");
      setError(r.error);
      return;
    }
    setStatus("sent");
    setCooldown(COOLDOWN_SEC);
  }

  return (
    <div className="space-y-2">
      {!initialEmail && (
        <Input
          type="email"
          placeholder="이메일 주소"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}
      <Button
        type="button"
        onClick={onResend}
        disabled={!email || cooldown > 0 || status === "sending"}
        className="w-full"
        variant="outline"
      >
        {cooldown > 0
          ? `재발송 (${cooldown}초)`
          : status === "sending"
            ? "발송 중..."
            : "인증 메일 재발송"}
      </Button>
      {status === "sent" && (
        <p className="text-sm text-success">인증 메일을 다시 보냈습니다.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
