/**
 * 서브레딧 이름 규칙 (Reddit: 영문/숫자/밑줄 2~21자).
 * 클라이언트 컴포넌트도 쓰므로 Node 전용 의존성 없는 순수 모듈로 분리한다.
 */
const SUBREDDIT_RE = /^[A-Za-z0-9_]{2,21}$/;

/** "r/foo", "/r/foo", " foo " → "foo" */
export function normalizeSubreddit(input: string): string {
  return input
    .trim()
    .replace(/^\/?r\//i, "")
    .trim();
}

export function isValidSubreddit(input: string): boolean {
  return SUBREDDIT_RE.test(normalizeSubreddit(input));
}
