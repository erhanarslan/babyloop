import { z } from "zod";

export const adminModerationCaseParamsSchema = z.object({
  caseId: z.string().uuid()
});

export const adminModerationCasesQuerySchema = z.object({
  status: z
    .enum(["pending", "in_review", "resolved", "dismissed"])
    .optional(),
  targetType: z.enum(["listing", "profile", "message"]).optional(),
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

export type AdminModerationCasesQuery = z.infer<typeof adminModerationCasesQuerySchema>;
export type AdminModerationStatusBody = z.infer<typeof adminModerationStatusBodySchema>;
export type AdminModerationActionBody = z.infer<typeof adminModerationActionBodySchema>;