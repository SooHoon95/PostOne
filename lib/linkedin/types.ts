export type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number; // seconds
  scope: string;
  token_type: "Bearer";
  id_token?: string;
};

export type LinkedInUserInfo = {
  sub: string; // LinkedIn user ID
  name: string;
  email?: string;
  picture?: string;
};
