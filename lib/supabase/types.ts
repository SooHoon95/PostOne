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

export type ThreadsConnection = {
  id: string;
  user_id: string;
  threads_user_id: string;
  username: string | null;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
  expires_at: string;
  scope: string;
  created_at: string;
};

export type InstagramConnection = {
  id: string;
  user_id: string;
  instagram_business_id: string;
  facebook_page_id: string;
  username: string | null;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
  expires_at: string;
  scope: string;
  created_at: string;
};

export type Channel = "linkedin" | "threads" | "instagram";

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
  media_urls: string[] | null;
  batch_id: string | null;
  created_at: string;
};
