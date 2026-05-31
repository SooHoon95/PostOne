export type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number; // seconds
  scope: string;
  token_type: "Bearer";
  id_token?: string;
  refresh_token?: string;
  refresh_token_expires_in?: number; // seconds
};

export type LinkedInRefreshResponse = {
  access_token: string;
  expires_in: number; // seconds
  refresh_token?: string;
  refresh_token_expires_in?: number; // seconds
  token_type: "Bearer";
  scope?: string;
};

export type LinkedInUserInfo = {
  sub: string; // LinkedIn user ID
  name: string;
  email?: string;
  picture?: string;
};
