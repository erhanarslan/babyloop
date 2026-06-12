import { describe, expect, it } from "vitest";
import {
  adminAiOpsRunsQuerySchema,
  adminAiOpsRunsResponseSchema,
  adminAiOpsSummaryResponseSchema
} from "../src/schemas/admin-ai-ops.schemas.js";

describe("admin AI ops schemas", () => {
  it("accepts safe AI ops filters", () => {
    const parsed = adminAiOpsRunsQuerySchema.safeParse({
      feature: "moderation_summary",
      providerName: "mock-moderation-summary",
      q: "30000000",
      status: "success",
      sort: "oldest",
      limit: "25"
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
    }
  });

  it("rejects unsafe AI ops filters", () => {
    expect(adminAiOpsRunsQuerySchema.safeParse({ status: "raw_output" }).success).toBe(false);
    expect(adminAiOpsRunsQuerySchema.safeParse({ sort: "raw" }).success).toBe(false);
    expect(adminAiOpsRunsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(adminAiOpsRunsQuerySchema.safeParse({ q: "" }).success).toBe(false);
  });

  it("accepts aggregate-only AI ops summary data", () => {
    const parsed = adminAiOpsSummaryResponseSchema.safeParse({
      summary: {
        totals: {
          totalRuns: 12,
          runsLast24Hours: 3,
          runsLast7Days: 8,
          successRunsLast7Days: 6,
          failedRunsLast7Days: 2,
          providerFailuresLast7Days: 1,
          validationFailuresLast7Days: 1,
          skippedRunsLast7Days: 0
        },
        statusCounts: [
          { status: "success", count: 6 },
          { status: "error", count: 1 }
        ],
        providerModelCounts: [
          {
            providerName: "mock-moderation-summary",
            modelName: "mock-model",
            totalRuns: 7,
            successRuns: 6,
            failedRuns: 1
          }
        ],
        recentRuns: [
          {
            id: "30000000-0000-4000-8000-000000000001",
            feature: "moderation_summary",
            providerName: "mock-moderation-summary",
            modelName: "mock-model",
            promptVersion: "moderation_summary.mock.v1",
            status: "success",
            caseId: "30000000-0000-4000-8000-000000000002",
            confidenceScore: 0.75,
            riskScore: 50,
            errorSummary: null,
            createdAt: "2026-06-12T10:00:00.000Z"
          }
        ]
      }
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts safe AI ops runs response data", () => {
    const parsed = adminAiOpsRunsResponseSchema.safeParse({
      runs: [
        {
          id: "30000000-0000-4000-8000-000000000001",
          feature: "moderation_summary",
          providerName: "openai",
          modelName: "gpt-4.1-mini",
          promptVersion: "moderation_summary.openai.v1",
          status: "provider_failed",
          caseId: "30000000-0000-4000-8000-000000000002",
          confidenceScore: null,
          riskScore: null,
          errorSummary: "Provider failed without exposing raw input or output.",
          createdAt: "2026-06-12T10:00:00.000Z"
        }
      ]
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects raw AI payload fields", () => {
    const parsed = adminAiOpsRunsResponseSchema.safeParse({
      runs: [
        {
          id: "30000000-0000-4000-8000-000000000001",
          feature: "moderation_summary",
          providerName: "openai",
          modelName: "gpt-4.1-mini",
          promptVersion: "moderation_summary.openai.v1",
          status: "success",
          caseId: "30000000-0000-4000-8000-000000000002",
          confidenceScore: 0.7,
          riskScore: 50,
          errorSummary: null,
          createdAt: "2026-06-12T10:00:00.000Z",
          input: { raw: "prompt" },
          output: { raw: "model output" },
          rawPrompt: "do not expose"
        }
      ]
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects identity-like fields in AI ops responses", () => {
    const parsed = adminAiOpsSummaryResponseSchema.safeParse({
      summary: {
        totals: {
          totalRuns: 1,
          runsLast24Hours: 1,
          runsLast7Days: 1,
          successRunsLast7Days: 1,
          failedRunsLast7Days: 0,
          providerFailuresLast7Days: 0,
          validationFailuresLast7Days: 0,
          skippedRunsLast7Days: 0
        },
        statusCounts: [],
        providerModelCounts: [],
        recentRuns: [],
        reporterEmail: "reporter@example.com",
        messageBody: "raw body",
        accessToken: "secret"
      }
    });

    expect(parsed.success).toBe(false);
  });
});
