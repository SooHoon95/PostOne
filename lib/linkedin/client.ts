const POSTS_URL = "https://api.linkedin.com/rest/posts";
const VERSION = "202509";

type PublishParams = {
  accessToken: string;
  authorSub: string; // LinkedIn user `sub` (from /userinfo)
  commentary: string;
};

type PublishResult = {
  urn: string;
};

export async function publishPost({
  accessToken,
  authorSub,
  commentary,
}: PublishParams): Promise<PublishResult> {
  const body = {
    author: `urn:li:person:${authorSub}`,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const res = await fetch(POSTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn publish failed: ${res.status} ${text}`);
  }

  const urn = res.headers.get("x-restli-id") ?? "";
  return { urn };
}
