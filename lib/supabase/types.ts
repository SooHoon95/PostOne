export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
};

export type LinkedInConnection = {
  id: string;
  user_id: string;
  linkedin_sub: string;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
  expires_at: string;
  scope: string;
  created_at: string;
};

export type PublishStatus = "pending" | "success" | "failed";

export type Post = {
  id: string;
  user_id: string;
  content: string;
  channel: string;
  external_id: string | null;
  status: PublishStatus;
  error_message: string | null;
  published_at: string | null;
  created_at: string;
};
