import type {
  ThreadsContainerCreateResponse,
  ThreadsPublishResponse,
} from "./types";

const API_BASE = "https://graph.threads.net/v1.0";

type PublishParams = {
  accessToken: string;
  userId: string; // Threads user id (from OAuth)
  text: string;
};

type PublishResult = {
  mediaId: string;
};

const THREADS_MAX = 500;

export async function publishPost({
  accessToken,
  userId,
  text,
}: PublishParams): Promise<PublishResult> {
  if (!text.trim()) throw new Error("Threads: text is empty");
  if (text.length > THREADS_MAX) {
    throw new Error(`Threads: text exceeds ${THREADS_MAX} chars`);
  }

  // Step 1: create container
  const containerUrl = new URL(`${API_BASE}/${userId}/threads`);
  containerUrl.searchParams.set("media_type", "TEXT");
  containerUrl.searchParams.set("text", text);
  containerUrl.searchParams.set("access_token", accessToken);

  const containerRes = await fetch(containerUrl.toString(), { method: "POST" });
  if (!containerRes.ok) {
    const t = await containerRes.text();
    throw new Error(`Threads container create failed: ${containerRes.status} ${t}`);
  }
  const container = (await containerRes.json()) as ThreadsContainerCreateResponse;

  // Step 2: publish container
  const publishUrl = new URL(`${API_BASE}/${userId}/threads_publish`);
  publishUrl.searchParams.set("creation_id", container.id);
  publishUrl.searchParams.set("access_token", accessToken);

  const publishRes = await fetch(publishUrl.toString(), { method: "POST" });
  if (!publishRes.ok) {
    const t = await publishRes.text();
    throw new Error(`Threads publish failed: ${publishRes.status} ${t}`);
  }
  const result = (await publishRes.json()) as ThreadsPublishResponse;
  return { mediaId: result.id };
}
