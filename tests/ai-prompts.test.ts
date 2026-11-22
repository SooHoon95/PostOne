import { describe, it, expect } from "vitest";
import {
  buildAdaptMessages,
  buildOutputContract,
  buildSystemPrompt,
  buildUserPrompt,
  CHANNEL_GUIDANCE,
} from "@/lib/ai/prompts";
import { CHANNEL_LIMITS, type AdaptRequest } from "@/lib/ai/types";

const base: AdaptRequest = {
  sourceText: "뮤터라는 음악 편지 앱을 혼자 만들어 앱스토어에 출시했다. 3주 만에 심사를 통과했다.",
  channels: ["linkedin", "threads"],
  language: "ko",
};

describe("buildSystemPrompt", () => {
  it("JSON-only output and no-fabrication rules", () => {
    const system = buildSystemPrompt("ko");
    expect(system).toMatch(/single JSON object/);
    expect(system).toMatch(/Never invent metrics/);
    expect(system).toMatch(/Korean/);
  });

  it("switches the language directive", () => {
    expect(buildSystemPrompt("en")).toMatch(/Write every field in English/);
    expect(buildSystemPrompt("auto")).toMatch(/same language as the source/);
  });
});

describe("buildUserPrompt", () => {
  it("carries the source draft and only the requested channels", () => {
    const prompt = buildUserPrompt(base);
    expect(prompt).toContain(base.sourceText);
    expect(prompt).toContain("## linkedin");
    expect(prompt).toContain("## threads");
    expect(prompt).not.toContain("## instagram");
    expect(prompt).not.toContain("## reddit");
    expect(prompt).not.toContain("## peerlist");
  });

  it("states each platform length limit", () => {
    const prompt = buildUserPrompt({
      ...base,
      channels: ["linkedin", "threads", "instagram", "reddit", "peerlist"],
    });
    expect(prompt).toContain(`${CHANNEL_LIMITS.linkedin.content} characters`);
    expect(prompt).toContain(`${CHANNEL_LIMITS.threads.content} characters`);
    expect(prompt).toContain(`${CHANNEL_LIMITS.instagram.caption} characters`);
    expect(prompt).toContain(`${CHANNEL_LIMITS.reddit.title} characters`);
    expect(prompt).toContain(
      `${CHANNEL_LIMITS.instagram.slidesMin}-${CHANNEL_LIMITS.instagram.slidesMax}`
    );
  });

  it("adds the subreddit audience hint only for Reddit", () => {
    const withReddit = buildUserPrompt({
      ...base,
      channels: ["reddit"],
      subreddit: "iosdev",
    });
    expect(withReddit).toContain("r/iosdev");

    const withoutReddit = buildUserPrompt({
      ...base,
      channels: ["linkedin"],
      subreddit: "iosdev",
    });
    expect(withoutReddit).not.toContain("r/iosdev");
  });

  it("keeps carousel slides within the Satori card limits", () => {
    expect(CHANNEL_GUIDANCE.instagram).toContain(
      `${CHANNEL_LIMITS.instagram.slideDescription} characters`
    );
    expect(CHANNEL_GUIDANCE.instagram).toMatch(/stands alone/);
    expect(CHANNEL_GUIDANCE.reddit).toMatch(/no hashtags/);
    expect(CHANNEL_GUIDANCE.peerlist).toMatch(/#buildinpublic/);
  });
});

describe("buildOutputContract", () => {
  it("lists exactly the requested channel keys", () => {
    const contract = buildOutputContract(["threads", "peerlist"]);
    expect(contract).toContain('{"channels":');
    expect(contract).toContain("- threads");
    expect(contract).toContain("- peerlist");
    expect(contract).not.toContain("- linkedin");
  });
});

describe("buildAdaptMessages", () => {
  it("splits system rules and the user prompt", () => {
    const messages = buildAdaptMessages(base);
    expect(messages.system).toMatch(/You adapt ONE source draft/);
    expect(messages.user).toContain(base.sourceText);
    expect(messages.user).not.toMatch(/You adapt ONE source draft/);
  });
});
