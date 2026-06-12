import { describe, expect, it } from "vitest";
import {
  adminModerationCaseInsightsResponseSchema,
  adminModerationEnforcementBodySchema,
  adminModerationAiSummariesQuerySchema,
  adminModerationAiSummaryBodySchema,
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


describe("admin moderation AI summary schema", () => {
  it("requires an explicit useful generation reason", () => {
    expect(
      adminModerationAiSummaryBodySchema.safeParse({
        reason: "Generate a redacted AI summary for moderation triage."
      }).success
    ).toBe(true);

    expect(adminModerationAiSummaryBodySchema.safeParse({ reason: "short" }).success)
      .toBe(false);
    expect(adminModerationAiSummaryBodySchema.safeParse({}).success).toBe(false);
  });
});


describe("admin moderation AI summaries query schema", () => {
  it("accepts a safe history limit", () => {
    const parsed = adminModerationAiSummariesQuerySchema.safeParse({
      limit: "5"
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.limit).toBe(5);
    }
  });

  it("rejects unsafe history limits", () => {
    expect(adminModerationAiSummariesQuerySchema.safeParse({ limit: "0" }).success)
      .toBe(false);
    expect(adminModerationAiSummariesQuerySchema.safeParse({ limit: "100" }).success)
      .toBe(false);
    expect(adminModerationAiSummariesQuerySchema.safeParse({ limit: "raw" }).success)
      .toBe(false);
  });
});


describe("admin moderation case insights response schema", () => {
  const caseId = "00000000-0000-4000-8000-000000000001";

  it("accepts safe case insight signals", () => {
    const parsed = adminModerationCaseInsightsResponseSchema.safeParse({
      caseId,
      insights: {
        caseId,
        generatedAt: "2026-06-12T12:00:00.000Z",
        targetProfile: {
          profileId: "00000000-0000-4000-8000-000000000002",
          displayName: "Safe Parent",
          safetyStatus: "restricted",
          source: "target_profile"
        },
        counts: {
          openCasesForTarget: 2,
          totalCasesForTarget: 4,
          reportsLast7Days: 1,
          reportsLast30Days: 3,
          priorEnforcementActions: 1,
          enforcementActionsLast30Days: 1,
          sensitiveAccessEvents: 1,
          aiSummaryRuns: 2,
          aiSummarySuccesses: 1,
          aiSummaryErrors: 1
        },
        latestAiSummary: {
          aiModelRunId: "00000000-0000-4000-8000-000000000003",
          riskLevel: "high",
          recommendedAction: "restrict_profile",
          confidenceScore: 0.82,
          createdAt: "2026-06-12T12:01:00.000Z"
        },
        risk: {
          score: 72,
          level: "high",
          signals: ["Recent reports for this target"]
        },
        recommendedNextStep: {
          code: "consider_enforcement",
          label: "Review enforcement options and prior history before closing this case."
        }
      }
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid insight risk levels and negative counts", () => {
    expect(
      adminModerationCaseInsightsResponseSchema.safeParse({
        caseId,
        insights: {
          caseId,
          generatedAt: "2026-06-12T12:00:00.000Z",
          targetProfile: null,
          counts: {
            openCasesForTarget: -1,
            totalCasesForTarget: 0,
            reportsLast7Days: 0,
            reportsLast30Days: 0,
            priorEnforcementActions: 0,
            enforcementActionsLast30Days: 0,
            sensitiveAccessEvents: 0,
            aiSummaryRuns: 0,
            aiSummarySuccesses: 0,
            aiSummaryErrors: 0
          },
          latestAiSummary: null,
          risk: {
            score: 101,
            level: "severe",
            signals: []
          },
          recommendedNextStep: {
            code: "raw_sensitive_review",
            label: "Invalid code"
          }
        }
      }).success
    ).toBe(false);
  });
});
