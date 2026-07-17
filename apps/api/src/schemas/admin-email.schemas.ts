import { z } from "zod";

export const adminEmailIntentSchema = z.enum([
  "email_verification",
  "password_reset",
  "notification_digest",
  "security_alert"
]);

export const adminEmailTestSendBodySchema = z
  .object({
    to: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    intent: adminEmailIntentSchema.optional().default("security_alert"),
    note: z.string().trim().max(240).optional(),
    confirmation: z.literal("SEND_TEST_EMAIL")
  })
  .strict();

export type AdminEmailTestSendBody = z.infer<typeof adminEmailTestSendBodySchema>;
