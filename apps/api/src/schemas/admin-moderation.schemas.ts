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
export type AdminSensitiveAccessBody = z.infer<typeof adminSensitiveAccessBodySchema>;
export type AdminSensitiveAccessField = z.infer<typeof adminSensitiveAccessFieldSchema>;
