"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <EmptyState
          icon={<AlertTriangle />}
          title="문제가 발생했습니다"
          description="잠시 후 다시 시도해주세요. 문제가 계속되면 새로고침해주세요."
          action={<Button onClick={reset}>다시 시도</Button>}
        />
      </div>
    </div>
  );
}
