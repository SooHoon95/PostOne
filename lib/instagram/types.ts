// New Instagram API (with Business Login, 2024+)
export type InstagramShortTokenResponse = {
  access_token: string;
  user_id: number | string;
  permissions: string; // comma-separated
};

export type InstagramLongTokenResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number; // seconds (~60 days)
};

export type InstagramUserInfo = {
  id: string;          // app-scoped ID
  user_id: string;     // IG account id (use for publishing)
  username: string;
  account_type?: string; // BUSINESS or CREATOR
};

export type InstagramContainerResponse = {
  id: string;
};

export type InstagramPublishResponse = {
  id: string; // published media id
};
