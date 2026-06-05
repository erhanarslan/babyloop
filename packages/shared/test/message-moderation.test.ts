import { describe, expect, it } from "vitest";
import { moderateMessageBody } from "../src/message-moderation.js";

describe("message moderation", () => {
  it("allows a normal marketplace message", () => {
    expect(moderateMessageBody("Merhaba, urun hala satilik mi? Pazarlik olur mu?")).toEqual({
      allowed: true
    });
  });

  it("blocks Turkish profanity", () => {
    expect(moderateMessageBody("siktir git")).toEqual({
      allowed: false,
      reason: "PROFANITY"
    });
  });

  it("blocks English profanity", () => {
    expect(moderateMessageBody("fuck off")).toEqual({
      allowed: false,
      reason: "PROFANITY"
    });
  });

  it("blocks obfuscated profanity", () => {
    expect(moderateMessageBody("f.u.c.k you")).toEqual({
      allowed: false,
      reason: "PROFANITY"
    });
  });

  it("blocks sexual content", () => {
    expect(moderateMessageBody("porno icerik gonder")).toEqual({
      allowed: false,
      reason: "SEXUAL_CONTENT"
    });
  });

  it("blocks threats", () => {
    expect(moderateMessageBody("seni oldururum")).toEqual({
      allowed: false,
      reason: "THREAT"
    });
  });

  it("blocks repeated-character spam", () => {
    expect(moderateMessageBody("aaaaaaaaaaa")).toEqual({
      allowed: false,
      reason: "SPAM"
    });
  });

  it("blocks repeated word or phrase spam", () => {
    expect(moderateMessageBody("hemen al hemen al hemen al hemen al")).toEqual({
      allowed: false,
      reason: "SPAM"
    });
  });

  it("does not block obvious normal product words", () => {
    expect(moderateMessageBody("Bisiklet koltugu temiz durumda, analiz ettim ve saglam.")).toEqual({
      allowed: true
    });
  });
});
