import { z } from "zod";
import { normalizePlainText, validatePlainText } from "../services/text-safety.service.js";

export const notificationPreferenceSourceValues = [
  "child_reminder",
  "child_note",
  "saved_search",
  "child_lifecycle",
  "marketplace",
  "messages",
  "message",
  "listing",
  "security",
  "marketing",
  "trust_safety"
] as const;

export const notificationPreferenceChannelValues = [
  "in_app",
  "email",
  "push",
  "n8n",
  "sms"
] as const;
export const notificationPreferenceDigestValues = ["immediate", "daily", "weekly"] as const;

export const notificationPreferenceSourceSchema = z.enum(notificationPreferenceSourceValues);
export const notificationPreferenceChannelSchema = z.enum(notificationPreferenceChannelValues);
export const notificationPreferenceDigestSchema = z.enum(notificationPreferenceDigestValues);

export const updateNotificationPreferenceBodySchema = z
  .object({
    source: notificationPreferenceSourceSchema,
    channel: notificationPreferenceChannelSchema,
    enabled: z.boolean(),
    mutedUntil: z.coerce.date().nullable().optional(),
    quietHoursStart: localTimeSchema().nullable().optional(),
    quietHoursEnd: localTimeSchema().nullable().optional(),
    timezone: timezoneSchema().optional().default("Europe/Istanbul"),
    digest: notificationPreferenceDigestSchema.optional().default("immediate"),
    reason: optionalPreferenceReasonSchema()
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.enabled === false &&
      (
        ((value.source === "security" || value.source === "trust_safety") && value.channel === "in_app") ||
        (value.source === "security" && value.channel === "push")
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Security-critical notifications cannot be disabled.",
        path: ["enabled"]
      });
    }
  });

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

function localTimeSchema() {
  return z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/u, "Quiet hours must use HH:mm format.");
}

function timezoneSchema() {
  return z.string().min(3).max(80).regex(/^[A-Za-z_/-]+$/u, "Timezone must be a safe IANA-like name.");
}

export type NotificationPreferenceSource = z.infer<typeof notificationPreferenceSourceSchema>;
export type NotificationPreferenceChannel = z.infer<typeof notificationPreferenceChannelSchema>;
export type NotificationPreferenceDigest = z.infer<typeof notificationPreferenceDigestSchema>;
export type UpdateNotificationPreferenceBody = z.infer<typeof updateNotificationPreferenceBodySchema>;
