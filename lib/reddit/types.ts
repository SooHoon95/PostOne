/** Reddit OAuth2 토큰 응답 (authorization_code · refresh_token 공통) */
export type RedditTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds (보통 86400 = 24시간)
  refresh_token?: string;
  scope?: string;
};

/** 토큰 엔드포인트 오류 — HTTP 200 + { error } 로 오는 경우가 있어 별도 확인 필요 */
export type RedditTokenError = {
  error: string;
};

/** GET /api/v1/me — 계정 식별 정보 */
export type RedditMe = {
  id: string; // 예: "abc123" (fullname 은 t2_ 접두사)
  name: string; // u/ 없이 표시되는 handle
  icon_img?: string;
};

/** /api/submit json.errors 항목: [코드, 사람이 읽을 설명, 대상 필드] */
export type RedditApiError = string[];

export type RedditSubmitData = {
  id: string; // 글 id (fullname 은 t3_ 접두사)
  name: string;
  url?: string;
  permalink?: string; // "/r/sub/comments/..."
};

export type RedditSubmitResponse = {
  json: {
    errors: RedditApiError[];
    data?: RedditSubmitData;
  };
};

/** GET /r/{subreddit}/api/link_flair_v2 항목 */
export type RedditFlair = {
  id: string;
  text: string;
  text_editable?: boolean;
};
