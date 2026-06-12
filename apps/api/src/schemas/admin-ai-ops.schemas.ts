import { z } from "zod";

const nonNegativeIntegerSchema = z.number().int().nonnegative();
const optionalScoreSchema = z.number().min(0).max(100).nullable();

export const adminAiOpsStatusSchema = z.enum([
  "success",
  "error",
  "validation_failed",
  "provider_failed",
  "skipped"
]);

export const adminAiOpsRunsQuerySchema = z.object({
  feature: z.string().trim().min(1).max(120).optional(),
  providerName: z.string().trim().min(1).max(120).optional(),
  status: adminAiOpsStatusSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(["newest", "oldest"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const adminAiOpsRunSummarySchema = z.object({
  id: z.string().uuid(),
  feature: z.string().min(1),
  providerName: z.string().min(1),
  modelName: z.string().nullable(),
  promptVersion: z.string().min(1),
  status: adminAiOpsStatusSchema,
  caseId: z.string().uuid().nullable(),
  confidenceScore: optionalScoreSchema,
  riskScore: optionalScoreSchema,
  errorSummary: z.string().nullable(),
  createdAt: z.string().datetime()
}).strict();

const adminAiOpsStatusCountSchema = z.object({
  status: adminAiOpsStatusSchema,
  count: nonNegativeIntegerSchema
}).strict();

const adminAiOpsProviderModelCountSchema = z.object({
  providerName: z.string().min(1),
  modelName: z.string().nullable(),
  totalRuns: nonNegativeIntegerSchema,
  successRuns: nonNegativeIntegerSchema,
  failedRuns: nonNegativeIntegerSchema
}).strict();

export const adminAiOpsSummarySchema = z.object({
  totals: z.object({
    totalRuns: nonNegativeIntegerSchema,
    runsLast24Hours: nonNegativeIntegerSchema,
    runsLast7Days: nonNegativeIntegerSchema,
    successRunsLast7Days: nonNegativeIntegerSchema,
    failedRunsLast7Days: nonNegativeIntegerSchema,
    providerFailuresLast7Days: nonNegativeIntegerSchema,
    validationFailuresLast7Days: nonNegativeIntegerSchema,
    skippedRunsLast7Days: nonNegativeIntegerSchema
  }).strict(),
  statusCounts: z.array(adminAiOpsStatusCountSchema),
  providerModelCounts: z.array(adminAiOpsProviderModelCountSchema),
  recentRuns: z.array(adminAiOpsRunSummarySchema)
}).strict();

export const adminAiOpsSummaryResponseSchema = z.object({
  summary: adminAiOpsSummarySchema
}).strict();

export const adminAiOpsRunsResponseSchema = z.object({
  runs: z.array(adminAiOpsRunSummarySchema)
}).strict();

export type AdminAiOpsRunsQuery = z.infer<typeof adminAiOpsRunsQuerySchema>;
export type AdminAiOpsRunSummaryResponse = z.infer<typeof adminAiOpsRunSummarySchema>;
export type AdminAiOpsSummaryResponse = z.infer<typeof adminAiOpsSummarySchema>;
