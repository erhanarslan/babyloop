import { z } from "zod";
import { normalizePlainText, validatePlainText } from "../services/text-safety.service.js";

const disallowedMedicalReminderCopyPattern =
  /(ilaç|ilac|ilacı|ilaci|ilaçı|ılaç|ılac|ılacı|ılaci|ılaçı|doz|dozu|dozaj|antibiyotik|antibiotic|paracetamol|parasetamol|calpol|aferin|ateş düşürücü|ates dusurucu|tedavi|treatment|medicine|medication|drug|dose|dosage|vitamin|vitamini|supplement|takviye|şurup|surup|damla|drop|drops|aşı|asi|vaccine|serum|antihistamin|antihistamine|kortizon|cortisone|ibuprofen|mg|ml)/iu;

function containsDisallowedMedicalReminderCopy(input: {
  title?: string | null | undefined;
  description?: string | null | undefined;
  body?: string | null | undefined;
  content?: string | null | undefined;
}): boolean {
  const text = [input.title, input.description, input.body, input.content]
    .filter((entry): entry is string => typeof entry === "string")
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  return disallowedMedicalReminderCopyPattern.test(text);
}

function rejectMedicalReminderCopy(
  value: { title?: string | null | undefined; description?: string | null | undefined; body?: string | null | undefined; content?: string | null | undefined },
  context: z.RefinementCtx
): void {
  if (!containsDisallowedMedicalReminderCopy(value)) {
    return;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Child reminders cannot include medical, medication, diagnosis, treatment, or dosage instructions.",
    path: ["title"]
  });
}



export const childProfileNoteTypeSchema = z.enum([
  "general",
  "feeding",
  "diaper",
  "sleep",
  "activity",
  "shopping",
  "health_note",
  "size",
  "preference",
  "daycare",
  "milestone"
]);

export const childProfileReminderChannelSchema = z.enum(["in_app", "email_draft"]);
export const childProfileReminderStatusSchema = z.enum(["scheduled", "paused", "completed", "cancelled"]);
export const childProfileReminderUpdateStatusSchema = z.enum(["scheduled", "completed", "cancelled"]);
export const childProfileReminderTypeSchema = z.enum([
  "feeding",
  "diaper",
  "sleep",
  "activity",
  "shopping",
  "appointment",
  "general"
]);
export const childProfileReminderScheduleKindSchema = z.enum([
  "one_time",
  "interval",
  "daily",
  "weekly",
  "relative_before_event"
]);

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
    body: optionalPlainTextSchema({ allowMultiline: true, maxLength: 2000 }),
    isPinned: z.boolean().optional().default(false)
  })
  .strict();

export const updateChildProfileNoteBodySchema = z
  .object({
    noteType: childProfileNoteTypeSchema.optional(),
    title: plainTextSchema({ maxLength: 100, minLength: 1 }).optional(),
    body: optionalPlainTextSchema({ allowMultiline: true, maxLength: 2000 }),
    isPinned: z.boolean().optional(),
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
    reminderType: childProfileReminderTypeSchema.optional().default("general"),
    scheduleKind: childProfileReminderScheduleKindSchema.optional().default("one_time"),
    intervalMinutes: z.number().int().min(15).max(43_200).optional(),
    remindAt: z.coerce.date().optional(),
    dueAt: z.coerce.date().optional(),
    eventAt: z.coerce.date().optional(),
    notifyBeforeMinutes: z.number().int().min(1).max(43_200).optional(),
    localTime: localTimeSchema().optional(),
    timezone: timezoneSchema().optional().default("Europe/Istanbul"),
    channel: childProfileReminderChannelSchema.optional().default("in_app")
  })
  .strict()
  .superRefine(validateReminderScheduleInput)
  .superRefine(validateNoMedicalReminder)
  .superRefine(rejectMedicalReminderCopy);

export const updateChildProfileReminderBodySchema = z
  .object({
    title: plainTextSchema({ maxLength: 120, minLength: 1 }).optional(),
    description: optionalPlainTextSchema({ allowMultiline: true, maxLength: 1000 }),
    reminderType: childProfileReminderTypeSchema.optional(),
    scheduleKind: childProfileReminderScheduleKindSchema.optional(),
    intervalMinutes: z.number().int().min(15).max(43_200).nullable().optional(),
    remindAt: z.coerce.date().optional(),
    dueAt: z.coerce.date().nullable().optional(),
    eventAt: z.coerce.date().nullable().optional(),
    notifyBeforeMinutes: z.number().int().min(1).max(43_200).nullable().optional(),
    localTime: localTimeSchema().nullable().optional(),
    timezone: timezoneSchema().optional(),
    channel: childProfileReminderChannelSchema.optional(),
    status: childProfileReminderUpdateStatusSchema.optional()
  })
  .strict()
  .superRefine(validateReminderScheduleInput)
  .superRefine(validateNoMedicalReminder)
  .refine(hasProvidedUpdateField, {
    message: "At least one reminder field must be provided."
  })
  .superRefine(rejectMedicalReminderCopy);

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

function localTimeSchema() {
  return z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/u, "localTime must use HH:mm format.");
}

function timezoneSchema() {
  return z.string().min(3).max(80).regex(/^[A-Za-z_/-]+$/u, "Timezone must be a safe IANA-like name.");
}

function validateReminderScheduleInput(
  value: {
    scheduleKind?: z.infer<typeof childProfileReminderScheduleKindSchema> | undefined;
    intervalMinutes?: number | null | undefined;
    remindAt?: Date | undefined;
    dueAt?: Date | null | undefined;
    eventAt?: Date | null | undefined;
    notifyBeforeMinutes?: number | null | undefined;
    localTime?: string | null | undefined;
  },
  context: z.RefinementCtx
) {
  const scheduleKind = value.scheduleKind;

  if (!scheduleKind) {
    return;
  }

  if (scheduleKind === "interval" && value.intervalMinutes === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Interval reminders require intervalMinutes.",
      path: ["intervalMinutes"]
    });
  }

  if (scheduleKind === "one_time" && !value.remindAt && !value.dueAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "One-time reminders require dueAt or remindAt.",
      path: ["dueAt"]
    });
  }

  if (scheduleKind === "relative_before_event" && (!value.eventAt || value.notifyBeforeMinutes === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Relative reminders require eventAt and notifyBeforeMinutes.",
      path: ["eventAt"]
    });
  }

  if ((scheduleKind === "daily" || scheduleKind === "weekly") && !value.localTime && !value.remindAt && !value.dueAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Daily and weekly reminders require localTime or dueAt.",
      path: ["localTime"]
    });
  }
}

function validateNoMedicalReminder(
  value: {
    title?: string | undefined;
    description?: string | null | undefined;
  },
  context: z.RefinementCtx
) {
  const combined = `${value.title ?? ""} ${value.description ?? ""}`;

  if (/\b(?:ilaç|tedavi|tanı|terapi|diyet|reçete|antibiyotik|doz)\b/iu.test(combined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Medical, therapy, diagnosis, drug, or diet reminders are outside BabyLoop scope.",
      path: ["title"]
    });
  }
}

export type ChildProfileNoteParams = z.infer<typeof childProfileNoteParamsSchema>;
export type ChildProfileReminderParams = z.infer<typeof childProfileReminderParamsSchema>;
export type ChildProfileNoteType = z.infer<typeof childProfileNoteTypeSchema>;
export type ChildProfileReminderChannel = z.infer<typeof childProfileReminderChannelSchema>;
export type ChildProfileReminderStatus = z.infer<typeof childProfileReminderStatusSchema>;
export type ChildProfileReminderType = z.infer<typeof childProfileReminderTypeSchema>;
export type ChildProfileReminderScheduleKind = z.infer<typeof childProfileReminderScheduleKindSchema>;
export type CreateChildProfileNoteBody = z.infer<typeof createChildProfileNoteBodySchema>;
export type UpdateChildProfileNoteBody = z.infer<typeof updateChildProfileNoteBodySchema>;
export type CreateChildProfileReminderBody = z.infer<typeof createChildProfileReminderBodySchema>;
export type UpdateChildProfileReminderBody = z.infer<typeof updateChildProfileReminderBodySchema>;
