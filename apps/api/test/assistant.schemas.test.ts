import { describe, expect, it } from "vitest";
import { assistantChatBodySchema } from "../src/schemas/assistant.schemas.js";

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
});
