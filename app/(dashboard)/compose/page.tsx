import { Editor } from "@/components/editor";
import { publishToLinkedIn } from "./actions";

export default function ComposePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">글쓰기</h1>
      <Editor publish={publishToLinkedIn} />
    </div>
  );
}
