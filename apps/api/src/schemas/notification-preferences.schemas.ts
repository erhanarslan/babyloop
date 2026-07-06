import { z } from "zod";
import { normalizePlainText, validatePlainText } from "../services/text-safety.service.js";

export const notificationPreferenceSourceValues = [
  "child_reminder",
  "saved_search",
  "child_lifecycle",
  "marketplace",
  "messages",
  "trust_safety"
] as const;

export const notificationPreferenceChannelValues = [
  "in_app",
  "email",
  "push",
  "n8n"
] as const;

export const notificationPreferenceSourceSchema = z.enum(notificationPreferenceSourceValues);
export const notificationPreferenceChannelSchema = z.enum(notificationPreferenceChannelValues);

export const updateNotificationPreferenceBodySchema = z
  .object({
    source: notificationPreferenceSourceSchema,
    channel: notificationPreferenceChannelSchema,
    enabled: z.boolean(),
    mutedUntil: z.coerce.date().nullable().optional(),
    reason: optionalPreferenceReasonSchema()
  })
  .strict();

function optionalPreferenceReasonSchema() {
  return z
    .preprocess((value) => {
      if (typeof value === "string" && value.trim() === "") {
        return null;
      }

      return value;
    }, z.string().nullable().optional())
    .refine(
      (value) => value === undefined || value === null || validatePlainText(value, {
        maxLength: 240,
        minLength: 1
      }).ok,
      {
        message: "Preference reason must be safe plaintext."
      }
    )
    .transform((value) => {
      if (value === undefined || value === null) {
        return null;
      }

      return normalizePlainText(value, {
        maxLength: 240,
        minLength: 1
      });
    });
}

export type NotificationPreferenceSource = z.infer<typeof notificationPreferenceSourceSchema>;
export type NotificationPreferenceChannel = z.infer<typeof notificationPreferenceChannelSchema>;
export type UpdateNotificationPreferenceBody = z.infer<typeof updateNotificationPreferenceBodySchema>;
