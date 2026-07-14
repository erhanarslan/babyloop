import type {
  CreateMobileChildNoteRequest,
  CreateMobileChildReminderRequest,
  MobileChildNote,
  MobileChildProfile,
  MobileChildReminder,
  UpdateMobileChildNoteRequest,
  UpdateMobileChildReminderRequest
} from "./child-reminders-api";
import { getNextMobileReminderDateIso } from "./child-reminders-model";

const DEFAULT_TIMEZONE = "Europe/Istanbul";

export type MobileChildReminderMutationKind =
  | "note_created"
  | "note_updated"
  | "note_archived"
  | "reminder_created"
  | "reminder_updated"
  | "reminder_completed"
  | "reminder_cancelled";

export type MobileChildNoteFormState = {
  body: string;
  noteType: MobileChildNote["noteType"];
  title: string;
};

export type MobileChildReminderQuickKind =
  | "shopping"
  | "feeding_interval"
  | "diaper_interval"
  | "appointment"
  | "activity_weekly";

export type MobileChildReminderFormState = {
  description: string;
  dueAt: string;
  eventAt: string;
  intervalMinutes: string;
  localTime: string;
  notifyBeforeMinutes: string;
  reminderType: MobileChildReminder["reminderType"];
  scheduleKind: MobileChildReminder["scheduleKind"];
  timezone: string;
  title: string;
};

export type MobileChildPayloadBuildResult<T> =
  | {
      ok: true;
      payload: T;
    }
  | {
      ok: false;
      message: string;
    };

export const mobileChildNoteTypeOptions: ReadonlyArray<{
  label: string;
  value: MobileChildNote["noteType"];
}> = [
  { label: "Genel", value: "general" },
  { label: "Beslenme", value: "feeding" },
  { label: "Bez", value: "diaper" },
  { label: "Uyku", value: "sleep" },
  { label: "Etkinlik", value: "activity" },
  { label: "Alışveriş", value: "shopping" },
  { label: "Beden", value: "size" },
  { label: "Tercih", value: "preference" },
  { label: "Okul / bakım", value: "daycare" },
  { label: "Gelişim notu", value: "milestone" }
];

export const mobileChildReminderQuickOptions: ReadonlyArray<{
  description: string;
  kind: MobileChildReminderQuickKind;
  title: string;
}> = [
  {
    kind: "shopping",
    title: "Alışveriş",
    description: "Bez, mama, kıyafet veya ihtiyaç listesi için tek seferlik hatırlatma."
  },
  {
    kind: "feeding_interval",
    title: "Beslenme takibi",
    description: "Örneğin 2 saatte bir uygulama içi hatırlatma."
  },
  {
    kind: "diaper_interval",
    title: "Bez takibi",
    description: "Gün içinde tekrar eden bez kontrolü."
  },
  {
    kind: "appointment",
    title: "Randevu",
    description: "Etkinlik veya randevudan önce hatırlatma."
  },
  {
    kind: "activity_weekly",
    title: "Haftalık etkinlik",
    description: "Oyun grubu, park, yüzme veya aktivite planı."
  }
];

export function getPreferredMobileChildProfile(
  childProfiles: MobileChildProfile[]
): MobileChildProfile | null {
  return childProfiles.find((profile) => profile.isActive) ?? childProfiles[0] ?? null;
}

export function canRunMobileChildProfileAction(
  childProfile: Pick<MobileChildProfile, "id"> | null,
  isSubmitting: boolean
): childProfile is Pick<MobileChildProfile, "id"> {
  return childProfile !== null && !isSubmitting;
}

export function normalizeMobileChildEntryTitle(value: string): string {
  return value.trim();
}

export function getMobileChildRequiredTitleMessage(kind: "note" | "reminder"): string {
  return kind === "note" ? "Not başlığı gerekli." : "Hatırlatıcı başlığı gerekli.";
}

export function getMobileChildMutationMessage(kind: MobileChildReminderMutationKind): string {
  const messages: Record<MobileChildReminderMutationKind, string> = {
    note_created: "Not eklendi.",
    note_updated: "Not güncellendi.",
    note_archived: "Not arşivlendi.",
    reminder_created: "Hatırlatıcı eklendi.",
    reminder_updated: "Hatırlatıcı güncellendi.",
    reminder_completed: "Hatırlatıcı tamamlandı.",
    reminder_cancelled: "Hatırlatıcı iptal edildi."
  };

  return messages[kind];
}

export function getMobileChildProfileMetaLabel(isLoading: boolean): string {
  return isLoading ? "Yükleniyor..." : "API bağlantılı";
}

export function getMobileChildDeliveryBoundaryText(): string {
  return "Günlük notlar ve uygulama içi hatırlatıcılar burada toplanır.";
}

export function createMobileChildNoteFormState(
  note?: MobileChildNote | null
): MobileChildNoteFormState {
  return {
    body: note?.body ?? "",
    noteType: note?.noteType ?? "general",
    title: note?.title ?? ""
  };
}

export function createMobileChildReminderFormState(
  kind: MobileChildReminderQuickKind = "shopping",
  now?: Date
): MobileChildReminderFormState {
  const baseDate = now ?? new Date();
  const tomorrow = getNextMobileReminderDateIso(baseDate);
  const appointment = new Date(baseDate);
  appointment.setDate(appointment.getDate() + 7);
  appointment.setHours(10, 0, 0, 0);

  if (kind === "feeding_interval") {
    return {
      description: "Beslenme notu",
      dueAt: "",
      eventAt: "",
      intervalMinutes: "120",
      localTime: "",
      notifyBeforeMinutes: "",
      reminderType: "feeding",
      scheduleKind: "interval",
      timezone: DEFAULT_TIMEZONE,
      title: "Beslenme zamanı"
    };
  }

  if (kind === "diaper_interval") {
    return {
      description: "Bez kontrolü",
      dueAt: "",
      eventAt: "",
      intervalMinutes: "180",
      localTime: "",
      notifyBeforeMinutes: "",
      reminderType: "diaper",
      scheduleKind: "interval",
      timezone: DEFAULT_TIMEZONE,
      title: "Bez kontrolü"
    };
  }

  if (kind === "appointment") {
    return {
      description: "Randevu veya etkinlik öncesi hazırlık",
      dueAt: "",
      eventAt: appointment.toISOString(),
      intervalMinutes: "",
      localTime: "",
      notifyBeforeMinutes: "1440",
      reminderType: "appointment",
      scheduleKind: "relative_before_event",
      timezone: DEFAULT_TIMEZONE,
      title: "Randevu hazırlığı"
    };
  }

  if (kind === "activity_weekly") {
    return {
      description: "Haftalık etkinlik planı",
      dueAt: "",
      eventAt: "",
      intervalMinutes: "",
      localTime: "10:00",
      notifyBeforeMinutes: "",
      reminderType: "activity",
      scheduleKind: "weekly",
      timezone: DEFAULT_TIMEZONE,
      title: "Haftalık etkinlik"
    };
  }

  return {
    description: "Alışveriş listesi",
    dueAt: tomorrow,
    eventAt: "",
    intervalMinutes: "",
    localTime: "",
    notifyBeforeMinutes: "",
    reminderType: "shopping",
    scheduleKind: "one_time",
    timezone: DEFAULT_TIMEZONE,
    title: "Hafta sonu bez al"
  };
}

export function createMobileChildReminderFormStateFromReminder(
  reminder: MobileChildReminder
): MobileChildReminderFormState {
  return {
    description: reminder.description ?? "",
    dueAt: reminder.dueAt ?? reminder.remindAt,
    eventAt: reminder.eventAt ?? "",
    intervalMinutes: reminder.intervalMinutes?.toString() ?? "",
    localTime: reminder.localTime ?? "",
    notifyBeforeMinutes: reminder.notifyBeforeMinutes?.toString() ?? "",
    reminderType: reminder.reminderType,
    scheduleKind: reminder.scheduleKind,
    timezone: reminder.timezone,
    title: reminder.title
  };
}

export function buildMobileChildNoteCreatePayload(title: string): CreateMobileChildNoteRequest {
  return {
    noteType: "general",
    title: normalizeMobileChildEntryTitle(title),
    body: null
  };
}

export function buildMobileChildNoteCreatePayloadFromState(
  state: MobileChildNoteFormState
): MobileChildPayloadBuildResult<CreateMobileChildNoteRequest> {
  const title = normalizeMobileChildEntryTitle(state.title);
  const body = normalizeOptionalChildText(state.body);

  if (!title) {
    return {
      ok: false,
      message: getMobileChildRequiredTitleMessage("note")
    };
  }

  return {
    ok: true,
    payload: {
      noteType: state.noteType,
      title,
      body
    }
  };
}

export function buildMobileChildNoteUpdatePayloadFromState(
  state: MobileChildNoteFormState
): MobileChildPayloadBuildResult<UpdateMobileChildNoteRequest> {
  const created = buildMobileChildNoteCreatePayloadFromState(state);

  if (!created.ok) {
    return created;
  }

  return {
    ok: true,
    payload: created.payload
  };
}

export function buildMobileChildReminderCreatePayload(
  title: string,
  now?: Date
): CreateMobileChildReminderRequest {
  const dueAt = getNextMobileReminderDateIso(now);

  return {
    title: normalizeMobileChildEntryTitle(title),
    reminderType: "shopping",
    scheduleKind: "one_time",
    dueAt,
    remindAt: dueAt,
    timezone: DEFAULT_TIMEZONE,
    channel: "in_app"
  };
}

export function buildMobileChildReminderCreatePayloadFromState(
  state: MobileChildReminderFormState
): MobileChildPayloadBuildResult<CreateMobileChildReminderRequest> {
  const title = normalizeMobileChildEntryTitle(state.title);
  const description = normalizeOptionalChildText(state.description);

  if (!title) {
    return {
      ok: false,
      message: getMobileChildRequiredTitleMessage("reminder")
    };
  }

  const base = {
    title,
    ...(description ? { description } : {}),
    reminderType: state.reminderType,
    scheduleKind: state.scheduleKind,
    timezone: normalizeTimezone(state.timezone),
    channel: "in_app" as const
  };

  if (state.scheduleKind === "interval") {
    const intervalMinutes = parsePositiveInteger(state.intervalMinutes);

    if (!intervalMinutes || intervalMinutes < 15) {
      return {
        ok: false,
        message: "Tekrarlı hatırlatıcı için en az 15 dakika aralık yaz."
      };
    }

    return {
      ok: true,
      payload: {
        ...base,
        intervalMinutes
      }
    };
  }

  if (state.scheduleKind === "daily" || state.scheduleKind === "weekly") {
    const localTime = normalizeLocalTime(state.localTime);

    if (!localTime) {
      return {
        ok: false,
        message: "Günlük/haftalık hatırlatıcı için HH:mm formatında saat yaz."
      };
    }

    return {
      ok: true,
      payload: {
        ...base,
        localTime
      }
    };
  }

  if (state.scheduleKind === "relative_before_event") {
    const eventAt = normalizeIsoDateInput(state.eventAt);
    const notifyBeforeMinutes = parsePositiveInteger(state.notifyBeforeMinutes);

    if (!eventAt || !notifyBeforeMinutes) {
      return {
        ok: false,
        message: "Randevu hatırlatıcısı için etkinlik tarihi ve kaç dakika önce alanları gerekli."
      };
    }

    return {
      ok: true,
      payload: {
        ...base,
        eventAt,
        notifyBeforeMinutes
      }
    };
  }

  const dueAt = normalizeIsoDateInput(state.dueAt) ?? getNextMobileReminderDateIso();

  return {
    ok: true,
    payload: {
      ...base,
      dueAt,
      remindAt: dueAt
    }
  };
}

export function buildMobileChildReminderUpdatePayloadFromState(
  state: MobileChildReminderFormState
): MobileChildPayloadBuildResult<UpdateMobileChildReminderRequest> {
  const created = buildMobileChildReminderCreatePayloadFromState(state);

  if (!created.ok) {
    return created;
  }

  return {
    ok: true,
    payload: created.payload
  };
}

export function getMobileChildReminderScheduleLabel(
  reminder: Pick<MobileChildReminder, "intervalMinutes" | "localTime" | "notifyBeforeMinutes" | "scheduleKind">
): string {
  if (reminder.scheduleKind === "interval") {
    return reminder.intervalMinutes ? `${reminder.intervalMinutes} dakikada bir` : "Tekrarlı";
  }

  if (reminder.scheduleKind === "daily") {
    return reminder.localTime ? `Her gün ${reminder.localTime}` : "Günlük";
  }

  if (reminder.scheduleKind === "weekly") {
    return reminder.localTime ? `Haftalık ${reminder.localTime}` : "Haftalık";
  }

  if (reminder.scheduleKind === "relative_before_event") {
    return reminder.notifyBeforeMinutes
      ? `Etkinlikten ${reminder.notifyBeforeMinutes} dk önce`
      : "Etkinlik öncesi";
  }

  return "Tek seferlik";
}

export function prependMobileChildNote(
  notes: MobileChildNote[],
  note: MobileChildNote
): MobileChildNote[] {
  return [note, ...notes];
}

export function removeMobileChildNote(
  notes: MobileChildNote[],
  noteId: string
): MobileChildNote[] {
  return notes.filter((note) => note.id !== noteId);
}

export function replaceMobileChildNote(
  notes: MobileChildNote[],
  noteId: string,
  nextNote: MobileChildNote
): MobileChildNote[] {
  return notes.map((note) => note.id === noteId ? nextNote : note);
}

export function appendMobileChildReminder(
  reminders: MobileChildReminder[],
  reminder: MobileChildReminder
): MobileChildReminder[] {
  return [...reminders, reminder];
}

export function replaceMobileChildReminder(
  reminders: MobileChildReminder[],
  reminderId: string,
  nextReminder: MobileChildReminder
): MobileChildReminder[] {
  return reminders.map((reminder) => reminder.id === reminderId ? nextReminder : reminder);
}

export function removeMobileChildReminder(
  reminders: MobileChildReminder[],
  reminderId: string
): MobileChildReminder[] {
  return reminders.filter((reminder) => reminder.id !== reminderId);
}

function normalizeOptionalChildText(value: string): string | null {
  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function normalizeTimezone(value: string): string {
  const normalized = value.trim();

  return normalized.length > 0 ? normalized : DEFAULT_TIMEZONE;
}

function normalizeIsoDateInput(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeLocalTime(value: string): string | null {
  const normalized = value.trim();

  if (/^[0-2][0-9]:[0-5][0-9]$/u.test(normalized)) {
    return normalized;
  }

  return null;
}

function parsePositiveInteger(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d+$/u.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
