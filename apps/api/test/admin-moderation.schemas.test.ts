import { describe, expect, it } from "vitest";
import {
  adminModerationEnforcementBodySchema,
  adminModerationCasesQuerySchema,
  adminSensitiveAccessBodySchema
} from "../src/schemas/admin-moderation.schemas.js";

describe("admin moderation cases query schema", () => {
  it("accepts safe triage filters", () => {
    const parsed = adminModerationCasesQuerySchema.safeParse({
      status: "pending",
      targetType: "message",
      q: "00000000",
      sort: "updated_desc",
      limit: "25"
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
      expect(parsed.data.q).toBe("00000000");
    }
  });

  it("rejects invalid triage filters", () => {
    expect(
      adminModerationCasesQuerySchema.safeParse({
        status: "open"
      }).success
    ).toBe(false);

    expect(
      adminModerationCasesQuerySchema.safeParse({
        targetType: "conversation"
      }).success
    ).toBe(false);

    expect(
      adminModerationCasesQuerySchema.safeParse({
        sort: "raw_message"
      }).success
    ).toBe(false);

    expect(
      adminModerationCasesQuerySchema.safeParse({
        limit: "500"
      }).success
    ).toBe(false);

    expect(
      adminModerationCasesQuerySchema.safeParse({
        q: ""
      }).success
    ).toBe(false);
  });
});

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

describe("admin moderation enforcement schema", () => {
  it("accepts allowlisted enforcement actions with explicit reasons", () => {
    const listingAction = adminModerationEnforcementBodySchema.safeParse({
      action: "listing_hide",
      reason: "Hide listing while reviewing safety report."
    });
    const profileAction = adminModerationEnforcementBodySchema.safeParse({
      action: "profile_suspend",
      reason: "Suspend profile after marketplace safety review."
    });

    expect(listingAction.success).toBe(true);
    expect(profileAction.success).toBe(true);
  });

  it("rejects invalid actions and weak reasons", () => {
    expect(
      adminModerationEnforcementBodySchema.safeParse({
        action: "profile_delete",
        reason: "Unsupported profile action should be rejected."
      }).success
    ).toBe(false);

    expect(
      adminModerationEnforcementBodySchema.safeParse({
        action: "message_hide",
        reason: "short"
      }).success
    ).toBe(false);

    expect(
      adminModerationEnforcementBodySchema.safeParse({
        reason: "Hide message after moderation review."
      }).success
    ).toBe(false);
  });
});
