import { z } from "zod";

export const adminModerationCaseParamsSchema = z.object({
  caseId: z.string().uuid()
});

export const adminModerationCasesQuerySchema = z.object({
  status: z
    .enum(["pending", "in_review", "resolved", "dismissed"])
    .optional(),
  targetType: z.enum(["listing", "profile", "message"]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  sort: z
    .enum(["newest", "oldest", "updated_desc", "updated_asc"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const adminModerationStatusBodySchema = z.object({
  status: z.enum(["pending", "in_review", "resolved", "dismissed"]),
  note: z.string().trim().max(1000).optional()
});

export const adminModerationActionBodySchema = z.object({
  actionType: z.enum(["note", "review_started", "dismissed", "resolved", "action_taken"]),
  note: z.string().trim().max(1000).optional()
});

export const adminSensitiveAccessFieldSchema = z.enum(["reporter", "message"]);

export const adminModerationEnforcementActionSchema = z.enum([
  "listing_hide",
  "listing_restore",
  "message_hide",
  "message_mark_reviewed",
  "profile_warn",
  "profile_restrict",
  "profile_suspend",
  "profile_restore"
]);

export const adminModerationEnforcementBodySchema = z.object({
  action: adminModerationEnforcementActionSchema,
  reason: z.string().trim().min(10).max(1000)
});


export const adminModerationAiSummaryBodySchema = z.object({
  reason: z.string().trim().min(10).max(1000)
});

export const adminModerationAiSummariesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional()
});



const adminProfileTrustSnapshotSchema = z.object({
  profileId: z.string().uuid(),
  trustScore: z.number().int().min(0).max(100),
  riskScore: z.number().int().min(0).max(100),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  safetyStatus: z.enum(["active", "restricted", "suspended"]),
  openCaseCount: z.number().int().min(0),
  totalCaseCount: z.number().int().min(0),
  recentReportCount: z.number().int().min(0),
  recentEnforcementCount: z.number().int().min(0),
  sensitiveAccessCount: z.number().int().min(0),
  aiSummaryCount: z.number().int().min(0),
  lastReportAt: z.string().datetime().nullable(),
  lastEnforcementAt: z.string().datetime().nullable(),
  computedAt: z.string().datetime()
});

export const adminModerationCaseInsightsResponseSchema = z.object({
  caseId: z.string().uuid(),
  insights: z.object({
    caseId: z.string().uuid(),
    generatedAt: z.string().datetime(),
    targetProfile: z
      .object({
        profileId: z.string().uuid(),
        displayName: z.string(),
        safetyStatus: z.enum(["active", "restricted", "suspended"]),
        source: z.enum(["target_profile", "listing_seller", "message_sender"])
      })
      .nullable(),
    counts: z.object({
      openCasesForTarget: z.number().int().min(0),
      totalCasesForTarget: z.number().int().min(0),
      reportsLast7Days: z.number().int().min(0),
      reportsLast30Days: z.number().int().min(0),
      priorEnforcementActions: z.number().int().min(0),
      enforcementActionsLast30Days: z.number().int().min(0),
      sensitiveAccessEvents: z.number().int().min(0),
      aiSummaryRuns: z.number().int().min(0),
      aiSummarySuccesses: z.number().int().min(0),
      aiSummaryErrors: z.number().int().min(0)
    }),
    latestAiSummary: z
      .object({
        aiModelRunId: z.string().uuid(),
        riskLevel: z.enum(["low", "medium", "high"]).nullable(),
        recommendedAction: z.string().nullable(),
        confidenceScore: z.number().nullable(),
        createdAt: z.string().datetime()
      })
      .nullable(),
    profileTrustSnapshot: adminProfileTrustSnapshotSchema.nullable(),
    risk: z.object({
      score: z.number().int().min(0).max(100),
      level: z.enum(["low", "medium", "high", "critical"]),
      signals: z.array(z.string()).min(1).max(20)
    }),
    recommendedNextStep: z.object({
      code: z.enum([
        "review_ai_summary",
        "review_sensitive_context",
        "consider_enforcement",
        "continue_review",
        "monitor_only"
      ]),
      label: z.string().min(1)
    })
  })
});

export const adminSensitiveAccessBodySchema = z.object({
  reason: z.string().trim().min(10).max(1000),
  fields: z
    .array(adminSensitiveAccessFieldSchema)
    .min(1)
    .max(2)
    .refine((fields) => new Set(fields).size === fields.length)
});

export type AdminModerationCasesQuery = z.infer<typeof adminModerationCasesQuerySchema>;
export type AdminModerationStatusBody = z.infer<typeof adminModerationStatusBodySchema>;
export type AdminModerationActionBody = z.infer<typeof adminModerationActionBodySchema>;
export type AdminModerationEnforcementAction = z.infer<typeof adminModerationEnforcementActionSchema>;
export type AdminModerationEnforcementBody = z.infer<typeof adminModerationEnforcementBodySchema>;
export type AdminModerationAiSummaryBody = z.infer<typeof adminModerationAiSummaryBodySchema>;
export type AdminModerationAiSummariesQuery = z.infer<typeof adminModerationAiSummariesQuerySchema>;
export type AdminModerationCaseInsightsResponse = z.infer<
  typeof adminModerationCaseInsightsResponseSchema
>;
export type AdminSensitiveAccessBody = z.infer<typeof adminSensitiveAccessBodySchema>;
export type AdminSensitiveAccessField = z.infer<typeof adminSensitiveAccessFieldSchema>;
