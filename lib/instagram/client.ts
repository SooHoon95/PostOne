// Instagram API with Business Login (2024+ NEW API)
// Publishing flow: container create → media_publish
// Reference: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
import type {
  InstagramContainerResponse,
  InstagramPublishResponse,
} from "./types";

const API_BASE = "https://graph.instagram.com/v21.0";

type PublishSingleParams = {
  accessToken: string;
  igUserId: string; // user_id from /me
  imageUrl: string; // publicly accessible URL
  caption: string;
};

type PublishCarouselParams = {
  accessToken: string;
  igUserId: string;
  imageUrls: string[]; // 2-10
  caption: string;
};

type PublishResult = {
  mediaId: string;
};

const CAPTION_MAX = 2200;

function validateCaption(caption: string) {
  if (caption.length > CAPTION_MAX) {
    throw new Error(`Instagram caption exceeds ${CAPTION_MAX} chars`);
  }
}

async function createContainer(
  igUserId: string,
  accessToken: string,
  params: Record<string, string>
): Promise<string> {
  const url = new URL(`${API_BASE}/${igUserId}/media`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram container failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as InstagramContainerResponse;
  return data.id;
}

async function publishContainer(
  igUserId: string,
  accessToken: string,
  creationId: string
): Promise<string> {
  const url = new URL(`${API_BASE}/${igUserId}/media_publish`);
  url.searchParams.set("creation_id", creationId);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram publish failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as InstagramPublishResponse;
  return data.id;
}

export async function publishSingle({
  accessToken,
  igUserId,
  imageUrl,
  caption,
}: PublishSingleParams): Promise<PublishResult> {
  validateCaption(caption);
  const containerId = await createContainer(igUserId, accessToken, {
    image_url: imageUrl,
    caption,
  });
  const mediaId = await publishContainer(igUserId, accessToken, containerId);
  return { mediaId };
}

export async function publishCarousel({
  accessToken,
  igUserId,
  imageUrls,
  caption,
}: PublishCarouselParams): Promise<PublishResult> {
  validateCaption(caption);
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error("Instagram carousel needs 2~10 images");
  }

  // 자식 컨테이너 N개 생성
  const childIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const id = await createContainer(igUserId, accessToken, {
      image_url: imageUrl,
      is_carousel_item: "true",
    });
    childIds.push(id);
  }

  // 캐러셀 부모 컨테이너 생성
  const parentId = await createContainer(igUserId, accessToken, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
  });

  const mediaId = await publishContainer(igUserId, accessToken, parentId);
  return { mediaId };
}
