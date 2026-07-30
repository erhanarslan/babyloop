import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import { z } from "zod";

import { validatePlainText } from "../services/text-safety.service.js";

export const authClientTypeSchema = z.enum(["web", "mobile", "backoffice"]);

export const registerBodySchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(128),
    displayName: plainTextField({ maxLength: 120, minLength: 2 }),
    locationCity: optionalPlainTextField({ maxLength: 120 }),
    termsAccepted: z.literal(true),
    termsVersion: z.literal(CURRENT_TERMS_VERSION)
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128),
    clientType: authClientTypeSchema.optional()
  })
  .strict();

export const passwordResetRequestSchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase())
  })
  .strict();

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().trim().min(1).max(512),
    newPassword: z.string().min(8).max(128)
  })
  .strict();

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128)
  })
  .strict();

export const emailVerificationRequestSchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase())
  })
  .strict();

export const emailVerificationConfirmSchema = z
  .object({
    token: z.string().trim().min(1).max(512)
  })
  .strict();

export const mfaVerifySchema = z
  .object({
    challengeId: z.string().uuid(),
    code: z.string().trim().regex(/^\d{6}$/)
  })
  .strict();

export const mfaPreferenceSchema = z
  .object({
    currentPassword: z.string().min(1).max(128)
  })
  .strict();

export const loginApprovalPreferenceSchema = z
  .object({
    currentPassword: z.string().min(1).max(128)
  })
  .strict();

export const sessionRevokeAllSchema = z
  .object({
    currentPassword: z.string().min(1).max(128)
  })
  .strict();

export const loginApprovalCompleteSchema = z
  .object({
    approvalToken: z.string().trim().min(32).max(512)
  })
  .strict();

export const accountDeletionRequestSchema = z
  .object({
    currentPassword: z.string().min(1).max(128).optional()
  })
  .strict();

export const accountDeletionConfirmSchema = z
  .object({
    challengeId: z.string().uuid(),
    code: z.string().trim().regex(/^\d{6}$/),
    confirmation: z.literal("HESABIMI SİL")
  })
  .strict();

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type PasswordResetRequestBody = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmBody = z.infer<typeof passwordResetConfirmSchema>;
export type PasswordChangeBody = z.infer<typeof passwordChangeSchema>;
export type EmailVerificationRequestBody = z.infer<typeof emailVerificationRequestSchema>;
export type EmailVerificationConfirmBody = z.infer<typeof emailVerificationConfirmSchema>;
export type MfaVerifyBody = z.infer<typeof mfaVerifySchema>;
export type MfaPreferenceBody = z.infer<typeof mfaPreferenceSchema>;
export type LoginApprovalPreferenceBody = z.infer<typeof loginApprovalPreferenceSchema>;
export type SessionRevokeAllBody = z.infer<typeof sessionRevokeAllSchema>;
export type LoginApprovalCompleteBody = z.infer<typeof loginApprovalCompleteSchema>;
export type AccountDeletionRequestBody = z.infer<typeof accountDeletionRequestSchema>;
export type AccountDeletionConfirmBody = z.infer<typeof accountDeletionConfirmSchema>;

export type SafeAuthValidationIssue = {
  code: string;
  path: string;
};

export function summarizeAuthValidationIssues(
  error: z.ZodError,
  limit = 8
): SafeAuthValidationIssue[] {
  return error.issues.slice(0, limit).map((issue) => ({
    code: issue.code,
    path: issue.path.map(String).join(".") || "$"
  }));
}

function plainTextField(options: {
  maxLength: number;
  minLength: number;
}) {
  return z.string().transform((value, context) => {
    const result = validatePlainText(value, options);

    if (!result.ok) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message
      });
      return z.NEVER;
    }

    return result.value;
  });
}

function optionalPlainTextField(options: { maxLength: number }) {
  return z
    .string()
    .transform((value, context) => {
      if (value.trim().length === 0) {
        return null;
      }

      const result = validatePlainText(value, {
        ...options,
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
    .transform((value) => value ?? null);
}
