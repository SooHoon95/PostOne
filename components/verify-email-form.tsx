"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyEmailOtp, resendConfirmation } from "@/lib/auth/actions";

type ResendStatus = "idle" | "sending" | "sent" | "error";

const COOLDOWN_SEC = 60;

export function VerifyEmailForm({ email: initialEmail }: { email: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resendStatus, setResendStatus] = useState<ResendStatus>("idle");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !code || verifying) return;
    setVerifying(true);
    setError(null);
    const r = await verifyEmailOtp({ email: email.trim(), token: code.trim() });
    // 성공 시 서버 액션이 /dashboard로 redirect → 여기 도달하면 실패한 경우다.
    setVerifying(false);
    if (r?.error) setError(r.error);
  }

  async function onResend() {
    if (!email || cooldown > 0 || resendStatus === "sending") return;
    setResendStatus("sending");
    setError(null);
    const r = await resendConfirmation({ email: email.trim() });
    if (r.error) {
      setResendStatus("error");
      setError(r.error);
      return;
    }
    setResendStatus("sent");
    setCooldown(COOLDOWN_SEC);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onVerify} className="space-y-3">
        {!initialEmail && (
          <Input
            type="email"
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="인증 코드 입력"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          maxLength={10}
          className="text-center tracking-[0.3em]"
        />
        <Button
          type="submit"
          className="w-full"
          disabled={verifying || !code || !email}
        >
          {verifying ? "확인 중..." : "인증 완료"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">메일을 못 받으셨나요?</span>
        <button
          type="button"
          onClick={onResend}
          disabled={!email || cooldown > 0 || resendStatus === "sending"}
          className="text-primary underline disabled:opacity-50"
        >
          {cooldown > 0
            ? `재발송 (${cooldown}초)`
            : resendStatus === "sending"
              ? "발송 중..."
              : "코드 재발송"}
        </button>
      </div>
      {resendStatus === "sent" && (
        <p className="text-sm text-success">인증 코드를 다시 보냈습니다.</p>
      )}
    </div>
  );
}
