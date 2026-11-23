import type { Channel, InstagramCard } from "@/lib/supabase/types";
import type { TemplateName } from "@/lib/cards/templates";

export type { Channel, InstagramCard };

/** 카드 배경 이미지까지 포함한 인스타그램 카드 입력 */
export type InstagramCardInput = InstagramCard;

export type RedditPublishInput = {
  subreddit: string;
  title: string;
  link?: string;
  flairId?: string;
};

export type MultiPublishInput = {
  channels: Channel[];
  body: string; // 공통 본문 (채널별 본문이 없을 때의 폴백)
  instagramCards: InstagramCard[]; // 빈 배열이면 빈 1장
  instagramTemplate?: TemplateName;
  reddit?: RedditPublishInput; // Reddit 선택 시 서브레딧/제목(필수)
  /**
   * 채널별 맞춤 본문(AI 채널별 변환 결과). 해당 채널 키가 없거나 빈 문자열이면
   * body로 폴백한다 — body만 전달하는 호출부와 호환.
   */
  channelContents?: Partial<Record<Channel, string>>;
};

export type ChannelResult = {
  channel: Channel;
  success: boolean;
  externalId?: string;
  permalink?: string;
  mediaUrls?: string[];
  error?: string;
};

export type ChannelPublishResult = {
  urn?: string;
  permalink?: string;
  error?: string;
};

export type MediaPublishResult = {
  mediaId?: string;
  mediaUrls?: string[];
  error?: string;
};
