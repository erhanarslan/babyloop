export type ChildNotebookReminderType =
  | "free_note"
  | "feeding"
  | "diaper"
  | "shopping"
  | "activity"
  | "appointment"
  | "sleep"
  | "other";

export type ChildNotebookReminderFrequency = "once" | "every_hours" | "daily" | "weekly" | "monthly" | "custom";
export type ChildNotebookAdvanceReminder = "none" | "same_day" | "one_day_before" | "one_week_before";

export type ChildNotebookReminderInput = {
  childProfileId: string;
  title: string;
  type: ChildNotebookReminderType;
  noteBody?: string | null;
  dueAt?: Date | string | null;
  frequency?: ChildNotebookReminderFrequency | null;
  intervalHours?: number | null;
  advanceReminder?: ChildNotebookAdvanceReminder | null;
  preferredTime?: string | null;
  notificationPreferenceEnabled: boolean;
  childProfileActive: boolean;
  createdByProfileOwner: boolean;
};

export type ChildNotebookReminderDecision = {
  valid: boolean;
  canSchedule: boolean;
  reasonCodes: Array<
    | "missing_child_profile"
    | "missing_title"
    | "inactive_child_profile"
    | "not_profile_owner"
    | "missing_due_at"
    | "invalid_interval"
    | "invalid_preferred_time"
    | "notification_preference_disabled"
    | "medical_boundary_required"
    | "valid"
  >;
  type: ChildNotebookReminderType;
  frequency: ChildNotebookReminderFrequency;
  advanceReminder: ChildNotebookAdvanceReminder;
  requiresNotificationPreference: true;
  requiresOwnerAccess: true;
  deliveryMutationAllowed: false;
  providerCallAllowed: false;
  medicalAdviceAllowed: false;
  therapyAdviceAllowed: false;
  drugAdviceAllowed: false;
  dietPrescriptionAllowed: false;
  piiSafe: true;
};

export type ChildNotebookReminderReadiness = {
  status: "readiness_only";
  runtimeCrudEnabled: false;
  notificationDeliveryEnabled: false;
  providerCallsAllowed: false;
  queueJobsAllowed: false;
  medicalAdviceAllowed: false;
  supportedTypes: ChildNotebookReminderType[];
  supportedFrequencies: ChildNotebookReminderFrequency[];
  supportedAdvanceReminders: ChildNotebookAdvanceReminder[];
  requiredFlows: string[];
  blockedUntilImplemented: string[];
  warning: string;
};

const SUPPORTED_TYPES: ChildNotebookReminderType[] = [
  "free_note",
  "feeding",
  "diaper",
  "shopping",
  "activity",
  "appointment",
  "sleep",
  "other"
];

const SUPPORTED_FREQUENCIES: ChildNotebookReminderFrequency[] = [
  "once",
  "every_hours",
  "daily",
  "weekly",
  "monthly",
  "custom"
];

const SUPPORTED_ADVANCE_REMINDERS: ChildNotebookAdvanceReminder[] = [
  "none",
  "same_day",
  "one_day_before",
  "one_week_before"
];

const MEDICAL_BOUNDARY_TERMS = [
  "diagnosis",
  "treatment",
  "dosage",
  "medicine",
  "drug",
  "therapy",
  "diet prescription",
  "tedavi",
  "ilaç",
  "doz",
  "tanı",
  "teşhis"
];

export function evaluateChildNotebookReminder(input: ChildNotebookReminderInput): ChildNotebookReminderDecision {
  const reasonCodes: ChildNotebookReminderDecision["reasonCodes"] = [];

  if (!input.childProfileId.trim()) {
    reasonCodes.push("missing_child_profile");
  }

  if (!input.title.trim()) {
    reasonCodes.push("missing_title");
  }

  if (!input.childProfileActive) {
    reasonCodes.push("inactive_child_profile");
  }

  if (!input.createdByProfileOwner) {
    reasonCodes.push("not_profile_owner");
  }

  const frequency = input.frequency ?? "once";
  const advanceReminder = input.advanceReminder ?? "none";
  const dueAt = normalizeDate(input.dueAt);

  if (frequency !== "custom" && frequency !== "every_hours" && !dueAt && input.type !== "free_note") {
    reasonCodes.push("missing_due_at");
  }

  if (frequency === "every_hours" && (!Number.isInteger(input.intervalHours) || Number(input.intervalHours) < 1 || Number(input.intervalHours) > 24)) {
    reasonCodes.push("invalid_interval");
  }

  if (input.preferredTime && !isValidPreferredTime(input.preferredTime)) {
    reasonCodes.push("invalid_preferred_time");
  }

  if (!input.notificationPreferenceEnabled && input.type !== "free_note") {
    reasonCodes.push("notification_preference_disabled");
  }

  if (containsMedicalBoundaryTerm(`${input.title} ${input.noteBody ?? ""}`)) {
    reasonCodes.push("medical_boundary_required");
  }

  const valid = reasonCodes.length === 0;
  const canSchedule = valid && input.type !== "free_note";

  return {
    valid,
    canSchedule,
    reasonCodes: valid ? ["valid"] : reasonCodes,
    type: input.type,
    frequency,
    advanceReminder,
    requiresNotificationPreference: true,
    requiresOwnerAccess: true,
    deliveryMutationAllowed: false,
    providerCallAllowed: false,
    medicalAdviceAllowed: false,
    therapyAdviceAllowed: false,
    drugAdviceAllowed: false,
    dietPrescriptionAllowed: false,
    piiSafe: true
  };
}

export function getChildNotebookReminderReadiness(): ChildNotebookReminderReadiness {
  return {
    status: "readiness_only",
    runtimeCrudEnabled: false,
    notificationDeliveryEnabled: false,
    providerCallsAllowed: false,
    queueJobsAllowed: false,
    medicalAdviceAllowed: false,
    supportedTypes: SUPPORTED_TYPES,
    supportedFrequencies: SUPPORTED_FREQUENCIES,
    supportedAdvanceReminders: SUPPORTED_ADVANCE_REMINDERS,
    requiredFlows: [
      "create free note",
      "edit free note",
      "delete free note",
      "create one-time reminder",
      "create recurring reminder",
      "create every 2 hours feeding reminder",
      "create advance reminder one week before",
      "create advance reminder one day before",
      "choose reminder time",
      "complete reminder",
      "cancel reminder",
      "snooze reminder",
      "link reminder to notification preference",
      "web child notebook QA",
      "mobile child notebook QA",
      "no medical/therapy/diagnosis/drug/diet advice"
    ],
    blockedUntilImplemented: [
      "runtime notebook CRUD",
      "runtime reminder scheduling",
      "queue jobs",
      "notification provider calls",
      "real push sending",
      "real email sending",
      "real n8n workflow triggering"
    ],
    warning:
      "Child notebook/reminder hardening is readiness-only; it does not create runtime CRUD, schedule queue jobs, send notifications, call providers, trigger n8n, or provide medical/therapy/diagnosis/drug/diet advice."
  };
}

export function assertChildNotebookReminderReadinessOnly(): {
  runtimeCrudEnabled: false;
  notificationDeliveryEnabled: false;
  providerCallsAllowed: false;
  queueJobsAllowed: false;
  medicalAdviceAllowed: false;
} {
  const readiness = getChildNotebookReminderReadiness();

  return {
    runtimeCrudEnabled: readiness.runtimeCrudEnabled,
    notificationDeliveryEnabled: readiness.notificationDeliveryEnabled,
    providerCallsAllowed: readiness.providerCallsAllowed,
    queueJobsAllowed: readiness.queueJobsAllowed,
    medicalAdviceAllowed: readiness.medicalAdviceAllowed
  };
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isValidPreferredTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function containsMedicalBoundaryTerm(value: string): boolean {
  const normalized = value.toLocaleLowerCase("tr-TR");
  return MEDICAL_BOUNDARY_TERMS.some((term) => normalized.includes(term.toLocaleLowerCase("tr-TR")));
}
