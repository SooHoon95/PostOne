import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <EmptyState
          icon={<FileQuestion />}
          title="페이지를 찾을 수 없습니다"
          description="요청하신 페이지가 존재하지 않거나 이동되었습니다."
          action={
            <Link href="/" className={cn(buttonVariants())}>
              홈으로
            </Link>
          }
        />
      </div>
    </div>
  );
}
