export type FacebookTokenResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number; // 60 days for long-lived
};

export type FacebookPage = {
  id: string;
  name: string;
  access_token: string; // page access token
  instagram_business_account?: { id: string };
};

export type FacebookPagesResponse = {
  data: FacebookPage[];
};

export type InstagramAccountInfo = {
  igUserId: string;        // IG Business Account ID
  pageId: string;          // Connected FB Page ID
  username: string | null;
  pageAccessToken: string; // Page access token (used for publish)
};

export type InstagramContainerResponse = {
  id: string;
};

export type InstagramPublishResponse = {
  id: string; // published media id
};
