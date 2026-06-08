import { z } from "zod";
import { validatePlainText } from "../services/text-safety.service.js";

export const reportReasonValues = [
  "safety",
  "scam",
  "inappropriate",
  "prohibited_item",
  "harassment",
  "other"
] as const;

export const reportBodySchema = z
  .object({
    reason: z.enum(reportReasonValues),
    details: z
      .string()
      .transform((value, context) => {
        if (value.trim().length === 0) {
          return null;
        }

        const result = validatePlainText(value, {
          allowMultiline: true,
          maxLength: 1000,
          minLength: 1
        });

        if (!result.ok) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.message
          });
          return z.NEVER;
        }

        return result.value;
      })
      .optional()
      .nullable()
      .transform((value) => value ?? null)
  })
  .strict();

export const listingReportParamsSchema = z.object({
  listingId: z.string().uuid()
});

export const messageReportParamsSchema = z.object({
  messageId: z.string().uuid()
});

export const profileParamsSchema = z.object({
  profileId: z.string().uuid()
});

export type ReportBody = z.infer<typeof reportBodySchema>;
export type ReportReason = (typeof reportReasonValues)[number];
