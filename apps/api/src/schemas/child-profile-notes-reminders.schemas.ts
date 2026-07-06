import { z } from "zod";
import { normalizePlainText, validatePlainText } from "../services/text-safety.service.js";

export const childProfileNoteTypeSchema = z.enum([
  "general",
  "feeding",
  "sleep",
  "size",
  "preference",
  "daycare",
  "milestone"
]);

export const childProfileReminderChannelSchema = z.enum(["in_app", "email_draft"]);
export const childProfileReminderStatusSchema = z.enum(["scheduled", "completed", "cancelled"]);

export const childProfileNoteParamsSchema = z
  .object({
    childProfileId: z.string().uuid(),
    noteId: z.string().uuid().optional()
  })
  .strict();

export const childProfileReminderParamsSchema = z
  .object({
    childProfileId: z.string().uuid(),
    reminderId: z.string().uuid().optional()
  })
  .strict();

export const createChildProfileNoteBodySchema = z
  .object({
    noteType: childProfileNoteTypeSchema.optional().default("general"),
    title: plainTextSchema({ maxLength: 100, minLength: 1 }),
    body: optionalPlainTextSchema({ allowMultiline: true, maxLength: 2000 })
  })
  .strict();

export const updateChildProfileNoteBodySchema = z
  .object({
    noteType: childProfileNoteTypeSchema.optional(),
    title: plainTextSchema({ maxLength: 100, minLength: 1 }).optional(),
    body: optionalPlainTextSchema({ allowMultiline: true, maxLength: 2000 }),
    isArchived: z.boolean().optional()
  })
  .strict()
  .refine(hasProvidedUpdateField, {
    message: "At least one note field must be provided."
  });

export const createChildProfileReminderBodySchema = z
  .object({
    title: plainTextSchema({ maxLength: 120, minLength: 1 }),
    description: optionalPlainTextSchema({ allowMultiline: true, maxLength: 1000 }),
    remindAt: z.coerce.date(),
    channel: childProfileReminderChannelSchema.optional().default("in_app")
  })
  .strict();

export const updateChildProfileReminderBodySchema = z
  .object({
    title: plainTextSchema({ maxLength: 120, minLength: 1 }).optional(),
    description: optionalPlainTextSchema({ allowMultiline: true, maxLength: 1000 }),
    remindAt: z.coerce.date().optional(),
    channel: childProfileReminderChannelSchema.optional(),
    status: childProfileReminderStatusSchema.optional()
  })
  .strict()
  .refine(hasProvidedUpdateField, {
    message: "At least one reminder field must be provided."
  });

type PlainTextOptions = {
  allowMultiline?: boolean;
  maxLength: number;
  minLength?: number;
};

function plainTextSchema(options: PlainTextOptions) {
  return z
    .string()
    .refine((value) => validatePlainText(value, options).ok, {
      message: "Text must be safe plaintext."
    })
    .transform((value) => normalizePlainText(value, options));
}

function optionalPlainTextSchema(options: PlainTextOptions) {
  return z
    .preprocess((value) => {
      if (typeof value === "string" && value.trim() === "") {
        return null;
      }

      return value;
    }, z.string().nullable().optional())
    .refine(
      (value) => value === undefined || value === null || validatePlainText(value, {
        ...options,
        minLength: 1
      }).ok,
      {
        message: "Text must be safe plaintext."
      }
    )
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null) {
        return null;
      }

      return normalizePlainText(value, options);
    });
}

function hasProvidedUpdateField(value: object) {
  return Object.values(value).some((fieldValue) => fieldValue !== undefined);
}

export type ChildProfileNoteParams = z.infer<typeof childProfileNoteParamsSchema>;
export type ChildProfileReminderParams = z.infer<typeof childProfileReminderParamsSchema>;
export type ChildProfileNoteType = z.infer<typeof childProfileNoteTypeSchema>;
export type ChildProfileReminderChannel = z.infer<typeof childProfileReminderChannelSchema>;
export type ChildProfileReminderStatus = z.infer<typeof childProfileReminderStatusSchema>;
export type CreateChildProfileNoteBody = z.infer<typeof createChildProfileNoteBodySchema>;
export type UpdateChildProfileNoteBody = z.infer<typeof updateChildProfileNoteBodySchema>;
export type CreateChildProfileReminderBody = z.infer<typeof createChildProfileReminderBodySchema>;
export type UpdateChildProfileReminderBody = z.infer<typeof updateChildProfileReminderBodySchema>;
