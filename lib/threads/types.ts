export type ThreadsTokenResponse = {
  access_token: string;
  user_id: string | number;
};

export type ThreadsLongLivedTokenResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number; // seconds (~60 days)
};

export type ThreadsUserInfo = {
  id: string;
  username: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
};

export type ThreadsContainerCreateResponse = {
  id: string; // container id
};

export type ThreadsPublishResponse = {
  id: string; // media id (URN-equivalent)
};
