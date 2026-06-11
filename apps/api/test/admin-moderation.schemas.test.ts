import { describe, expect, it } from "vitest";
import { adminSensitiveAccessBodySchema } from "../src/schemas/admin-moderation.schemas.js";

describe("admin moderation sensitive access schema", () => {
  it("accepts explicit reason and allowlisted fields", () => {
    const parsed = adminSensitiveAccessBodySchema.safeParse({
      reason: "Review raw message for safety triage.",
      fields: ["reporter", "message"]
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects missing or too-short reason", () => {
    expect(
      adminSensitiveAccessBodySchema.safeParse({
        fields: ["reporter"]
      }).success
    ).toBe(false);

    expect(
      adminSensitiveAccessBodySchema.safeParse({
        reason: "too short",
        fields: ["reporter"]
      }).success
    ).toBe(false);
  });

  it("rejects empty, duplicate, and invalid fields", () => {
    expect(
      adminSensitiveAccessBodySchema.safeParse({
        reason: "Review reporter identity for moderation triage.",
        fields: []
      }).success
    ).toBe(false);

    expect(
      adminSensitiveAccessBodySchema.safeParse({
        reason: "Review reporter identity for moderation triage.",
        fields: ["reporter", "reporter"]
      }).success
    ).toBe(false);

    expect(
      adminSensitiveAccessBodySchema.safeParse({
        reason: "Review reporter identity for moderation triage.",
        fields: ["*"]
      }).success
    ).toBe(false);
  });
});
