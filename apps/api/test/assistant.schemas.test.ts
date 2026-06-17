import { describe, expect, it } from "vitest";
import { mockAssistantMessageProvider } from "@babyloop/ai-core";
import {
  assistantChatBodySchema,
  assistantMessageBodySchema
} from "../src/schemas/assistant.schemas.js";

describe("assistant schemas", () => {
  it("accepts a valid assistant chat request", () => {
    const result = assistantChatBodySchema.safeParse({
      mode: "safe_buying",
      content: "What should I check before buying a stroller?"
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data.content : "").toBe(
      "What should I check before buying a stroller?"
    );
  });

  it("trims content", () => {
    const result = assistantChatBodySchema.safeParse({
      mode: "find_products",
      content: "  toddler winter items  "
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data.content : "").toBe("toddler winter items");
  });

  it("rejects empty content", () => {
    const result = assistantChatBodySchema.safeParse({
      mode: "find_products",
      content: "   "
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported modes and unknown fields", () => {
    expect(
      assistantChatBodySchema.safeParse({
        mode: "medical_advice",
        content: "What medicine should I use?"
      }).success
    ).toBe(false);

    expect(
      assistantChatBodySchema.safeParse({
        mode: "platform_help",
        content: "How do I browse?",
        extra: true
      }).success
    ).toBe(false);
  });

  it("accepts a valid Turkish assistant message request", () => {
    const result = assistantMessageBodySchema.safeParse({
      message: "  12 aylık bebeğim var nelere dikkat etmeliyim  ",
      locale: "tr"
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data.message : "").toBe(
      "12 aylık bebeğim var nelere dikkat etmeliyim"
    );
  });

  it("rejects empty assistant message requests and unknown fields", () => {
    expect(
      assistantMessageBodySchema.safeParse({
        message: "   "
      }).success
    ).toBe(false);

    expect(
      assistantMessageBodySchema.safeParse({
        message: "Merhaba",
        rawPrompt: true
      }).success
    ).toBe(false);
  });

  it("mock assistant provider answers Turkish 12-month questions directly", async () => {
    const answer = await mockAssistantMessageProvider.answerMessage({
      locale: "tr",
      message: "12 aylık bebeğim var nelere dikkat etmeliyim"
    });

    expect(answer.answer).toContain("12 aylık dönemde");
    expect(answer.answer).toContain("Evde sivri köşe");
    expect(answer.answer).not.toContain("privacy-light");
    expect(answer.answer).not.toContain("upcoming-needs");
  });
});
