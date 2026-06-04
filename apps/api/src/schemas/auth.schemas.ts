import { z } from "zod";

export const registerBodySchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(128),
    displayName: z.string().trim().min(2).max(120),
    locationCity: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null))
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128)
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

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type PasswordResetRequestBody = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmBody = z.infer<typeof passwordResetConfirmSchema>;
export type PasswordChangeBody = z.infer<typeof passwordChangeSchema>;
export type EmailVerificationRequestBody = z.infer<typeof emailVerificationRequestSchema>;
export type EmailVerificationConfirmBody = z.infer<typeof emailVerificationConfirmSchema>;
