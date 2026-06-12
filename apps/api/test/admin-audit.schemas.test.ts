import { describe, expect, it } from "vitest";
import {
  adminAuditEventsQuerySchema,
  adminAuditEventsResponseSchema
} from "../src/schemas/admin-audit.schemas.js";
import { sanitizeAuditMetadata } from "../src/services/admin-audit.service.js";

describe("admin audit schemas", () => {
  it("accepts safe audit event filters", () => {
    const parsed = adminAuditEventsQuerySchema.safeParse({
      actorProfileId: "30000000-0000-4000-8000-000000000001",
      entityType: "moderation_case",
      eventType: "admin_profile_enforcement_applied",
      q: "30000000",
      sort: "oldest",
      limit: "25"
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
    }
  });

  it("rejects invalid audit event filters", () => {
    expect(adminAuditEventsQuerySchema.safeParse({ sort: "raw_metadata" }).success)
      .toBe(false);
    expect(adminAuditEventsQuerySchema.safeParse({ limit: "500" }).success)
      .toBe(false);
    expect(adminAuditEventsQuerySchema.safeParse({ actorProfileId: "bad-id" }).success)
      .toBe(false);
    expect(adminAuditEventsQuerySchema.safeParse({ q: "" }).success).toBe(false);
  });

  it("accepts safe audit event response data", () => {
    const parsed = adminAuditEventsResponseSchema.safeParse({
      events: [
        {
          id: "30000000-0000-4000-8000-000000000001",
          eventType: "admin_profile_enforcement_applied",
          entityType: "moderation_case",
          entityId: "30000000-0000-4000-8000-000000000002",
          actorProfileId: "30000000-0000-4000-8000-000000000003",
          createdAt: "2026-06-12T10:00:00.000Z",
          metadata: {
            targetType: "profile",
            targetId: "30000000-0000-4000-8000-000000000004",
            previousSafetyStatus: "active",
            nextSafetyStatus: "suspended",
            reasonLength: 42
          }
        }
      ]
    });

    expect(parsed.success).toBe(true);
  });

  it("allows AI moderation summary metadata", () => {
    const sanitized = sanitizeAuditMetadata({
      caseId: "30000000-0000-4000-8000-000000000001",
      aiModelRunId: "30000000-0000-4000-8000-000000000002",
      modelName: "mock-model",
      providerName: "mock-moderation-summary",
      promptVersion: "moderation_summary.mock.v1",
      confidenceScore: 0.77,
      riskLevel: "medium",
      recommendedAction: "continue_review",
      reasonLength: 58,
      rawReason: "do not expose this"
    });

    expect(sanitized).toEqual({
      caseId: "30000000-0000-4000-8000-000000000001",
      aiModelRunId: "30000000-0000-4000-8000-000000000002",
      modelName: "mock-model",
      providerName: "mock-moderation-summary",
      promptVersion: "moderation_summary.mock.v1",
      confidenceScore: 0.77,
      riskLevel: "medium",
      recommendedAction: "continue_review",
      reasonLength: 58
    });
  });

  it("strips unsafe raw metadata keys", () => {
    const sanitized = sanitizeAuditMetadata({
      targetType: "profile",
      targetId: "30000000-0000-4000-8000-000000000004",
      previousSafetyStatus: "active",
      nextSafetyStatus: "suspended",
      reasonLength: 42,
      reporterEmail: "reporter@example.com",
      messageBody: "raw message",
      accessToken: "secret",
      rawReason: "free text reason"
    });

    expect(sanitized).toEqual({
      targetType: "profile",
      targetId: "30000000-0000-4000-8000-000000000004",
      previousSafetyStatus: "active",
      nextSafetyStatus: "suspended",
      reasonLength: 42
    });
  });
});
