import { describe, expect, it } from "vitest";
import {
  summarizeModerationCase,
  validateRedactedModerationSummaryInput,
  type ModerationSummaryInput,
  type ModerationSummaryProvider
} from "../../../packages/ai-core/src/index.js";

const safeInput: ModerationSummaryInput = {
  caseId: "30000000-0000-4000-8000-000000000001",
  targetType: "message",
  targetId: "30000000-0000-4000-8000-000000000002",
  status: "pending",
  priority: "normal",
  reportReason: "Buyer reported a potentially unsafe message.",
  targetPreview: {
    type: "message",
    summary: "Message 30000000 preview: [redacted-phone]"
  },
  recentTimelineLabels: ["Case created", "Report received"],
  previousEnforcementActions: []
};

describe("moderation AI guardrails", () => {
  it("accepts redacted moderation summary input", () => {
    expect(validateRedactedModerationSummaryInput(safeInput)).toEqual([]);
  });

  it("flags email-like and raw sensitive values before provider execution", () => {
    const issues = validateRedactedModerationSummaryInput({
      ...safeInput,
      reportReason: "Reporter email is reporter@example.com and raw message body should be reviewed."
    });

    expect(issues.map((issue) => issue.reason)).toContain("contains an email-like value");
    expect(issues.map((issue) => issue.reason)).toContain("contains unsafe sensitive-data wording");
  });

  it("rejects unsafe provider output", async () => {
    const unsafeProvider: ModerationSummaryProvider = {
      providerName: "unsafe-test-provider",
      async summarizeModerationCase() {
        return {
          summary: "Contact reporter@example.com for raw details.",
          riskLevel: "medium",
          recommendedAction: "continue_review",
          rationale: ["Unsafe raw output"],
          safetySignals: ["target:message"],
          confidenceScore: 0.5,
          providerName: "unsafe-test-provider",
          promptVersion: "test.v1"
        };
      }
    };

    await expect(summarizeModerationCase(safeInput, { provider: unsafeProvider })).rejects.toThrow(
      "Moderation summary output failed safety guardrails"
    );
  });
});
