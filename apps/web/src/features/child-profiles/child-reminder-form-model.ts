import type { ChildProfileReminder } from "./api";

export type WebChildReminderFormState = {
  description: string;
  eventDate: string;
  eventTime: string;
  intervalMinutes: string;
  localTime: string;
  notifyBeforeMinutes: string;
  reminderType: ChildProfileReminder["reminderType"];
  scheduleKind: ChildProfileReminder["scheduleKind"];
  title: string;
  oneTimeDate: string;
  oneTimeTime: string;
  timezone: string;
};

export type WebChildReminderCreatePayload = {
  channel: ChildProfileReminder["channel"];
  description?: string;
  dueAt?: string;
  eventAt?: string;
  intervalMinutes?: number;
  localTime?: string;
  notifyBeforeMinutes?: number;
  reminderType: ChildProfileReminder["reminderType"];
  remindAt?: string;
  scheduleKind: ChildProfileReminder["scheduleKind"];
  timezone: string;
  title: string;
};

export type WebChildReminderPayloadResult =
  | { ok: true; payload: WebChildReminderCreatePayload }
  | { ok: false; message: string };

const DEFAULT_TIMEZONE = "Europe/Istanbul";

export function buildDefaultWebChildReminderFormState(now = new Date()): WebChildReminderFormState {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 0, 0, 0);

  return {
    description: "",
    eventDate: formatDateInputValue(nextWeek),
    eventTime: "10:00",
    intervalMinutes: "120",
    localTime: "10:00",
    notifyBeforeMinutes: "1440",
    oneTimeDate: formatDateInputValue(tomorrow),
    oneTimeTime: "10:00",
    reminderType: "shopping",
    scheduleKind: "one_time",
    timezone: DEFAULT_TIMEZONE,
    title: ""
  };
}

export function buildWebChildReminderCreatePayloadFromState(
  state: WebChildReminderFormState,
  now = new Date()
): WebChildReminderPayloadResult {
  const title = normalizeRequiredText(state.title, 120);
  const description = normalizeOptionalText(state.description, 500);

  if (!title) {
    return { ok: false, message: "Hatırlatıcı başlığı gerekli." };
  }

  const base = {
    channel: "in_app" as const,
    ...(description ? { description } : {}),
    reminderType: state.reminderType,
    scheduleKind: state.scheduleKind,
    timezone: state.timezone.trim() || DEFAULT_TIMEZONE,
    title
  };

  if (state.scheduleKind === "interval") {
    const intervalMinutes = parsePositiveInteger(state.intervalMinutes);

    if (!intervalMinutes || intervalMinutes < 15) {
      return { ok: false, message: "Tekrarlı hatırlatıcı için en az 15 dakika aralık yaz." };
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
      return { ok: false, message: "Günlük/haftalık hatırlatıcı için geçerli bir saat seç." };
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
    const eventAt = combineWebChildLocalDateTimeToIso(state.eventDate, state.eventTime);
    const notifyBeforeMinutes = parsePositiveInteger(state.notifyBeforeMinutes);

    if (!eventAt || !notifyBeforeMinutes) {
      return {
        ok: false,
        message: "Randevu hatırlatıcısı için etkinlik tarihi, saati ve bildirim aralığı gerekli."
      };
    }

    if (isPastIsoDate(eventAt, now)) {
      return { ok: false, message: "Etkinlik tarihi geçmiş olamaz." };
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

  const dueAt = combineWebChildLocalDateTimeToIso(state.oneTimeDate, state.oneTimeTime);

  if (!dueAt) {
    return { ok: false, message: "Tek seferlik hatırlatıcı için tarih ve saat seç." };
  }

  if (isPastIsoDate(dueAt, now)) {
    return { ok: false, message: "Hatırlatıcı zamanı geçmiş olamaz." };
  }

  return {
    ok: true,
    payload: {
      ...base,
      dueAt,
      remindAt: dueAt
    }
  };
}

export function buildWebChildReminderFormStateFromReminder(
  reminder: ChildProfileReminder
): WebChildReminderFormState {
  const defaults = buildDefaultWebChildReminderFormState();
  const dueDateParts = splitIsoToLocalDateTime(reminder.dueAt ?? reminder.remindAt);
  const eventDateParts = splitIsoToLocalDateTime(reminder.eventAt ?? "");

  return {
    ...defaults,
    description: reminder.description ?? "",
    eventDate: eventDateParts.date || defaults.eventDate,
    eventTime: eventDateParts.time || defaults.eventTime,
    intervalMinutes: reminder.intervalMinutes ? String(reminder.intervalMinutes) : defaults.intervalMinutes,
    localTime: reminder.localTime ?? defaults.localTime,
    notifyBeforeMinutes: reminder.notifyBeforeMinutes ? String(reminder.notifyBeforeMinutes) : defaults.notifyBeforeMinutes,
    oneTimeDate: dueDateParts.date || defaults.oneTimeDate,
    oneTimeTime: dueDateParts.time || defaults.oneTimeTime,
    reminderType: reminder.reminderType,
    scheduleKind: reminder.scheduleKind,
    timezone: reminder.timezone || DEFAULT_TIMEZONE,
    title: reminder.title
  };
}

export function combineWebChildLocalDateTimeToIso(dateValue: string, timeValue: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dateValue.trim());
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(timeValue.trim());

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0
  );

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return date.toISOString();
}

export function splitIsoToLocalDateTime(value: string): { date: string; time: string } {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: "", time: "" };
  }

  return {
    date: formatDateInputValue(date),
    time: `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
  };
}

export function normalizeLocalTime(value: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(value.trim());

  if (!match) {
    return null;
  }

  return `${match[1]}:${match[2]}`;
}

function formatDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function isPastIsoDate(value: string, now: Date): boolean {
  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
}

function normalizeRequiredText(value: string, maxLength: number): string {
  return normalizeOptionalText(value, maxLength);
}

function normalizeOptionalText(value: string, maxLength: number): string {
  return value.replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, maxLength);
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
