import type {
  CreateMobileChildProfileRequest,
  MobileChildNote,
  MobileChildProfile,
  MobileChildProfileNotificationCadence,
  MobileChildReminder
} from "./child-reminders-api";

export type MobileChildNoteItem = {
  id?: string;
  title: string;
  value: string;
  noteType?: MobileChildNote["noteType"];
};

export type MobileChildReminderItem = {
  id?: string;
  title: string;
  value: string;
  status?: MobileChildReminder["status"];
};

export type MobileChildReminderSetting = {
  title: string;
  value: string;
  status: "active" | "disabled" | "draft";
};

const fallbackChildNoteItems = [
  { title: "Beslenme", value: "2 saatte bir" },
  { title: "Bez", value: "Günlük takip" },
  { title: "Etkinlik", value: "Randevu ve oyun" },
  { title: "Alışveriş", value: "Bez, mama, ihtiyaç" }
] as const satisfies readonly MobileChildNoteItem[];

const fallbackChildReminderItems = [
  { title: "Hafta sonu bez al", value: "Pratik hatırlatıcı örneği" },
  { title: "Havuz etkinliği", value: "1 hafta önce hatırlat" },
  { title: "Uyku düzeni", value: "Akşam notu örneği" }
] as const satisfies readonly MobileChildReminderItem[];

export function getMobileChildNoteItems(notes: MobileChildNote[] = []): MobileChildNoteItem[] {
  if (notes.length === 0) {
    return [...fallbackChildNoteItems];
  }

  return notes.map((note) => ({
    id: note.id,
    title: note.title,
    value: note.body ?? formatNoteType(note.noteType),
    noteType: note.noteType
  }));
}

export function getMobileChildReminderItems(
  reminders: MobileChildReminder[] = []
): MobileChildReminderItem[] {
  if (reminders.length === 0) {
    return [...fallbackChildReminderItems];
  }

  return reminders.map((reminder) => ({
    id: reminder.id,
    title: reminder.title,
    value: formatReminderValue(reminder),
    status: reminder.status
  }));
}

export function getMobileChildReminderSettings(
  childProfile?: Pick<MobileChildProfile, "notificationCadence"> | null
): MobileChildReminderSetting[] {
  const cadence = childProfile?.notificationCadence ?? "off";

  return [
    {
      title: "Çocuk profil önerileri",
      value: formatCadence(cadence),
      status: cadence === "off" ? "disabled" : "active"
    },
    {
      title: "Hatırlatıcı kanalı",
      value: "Uygulama içi",
      status: "active"
    },
    {
      title: "Email / push gönderimi",
      value: "Taslak altyapı; gerçek gönderim ayrı release",
      status: "draft"
    }
  ];
}

export function getDefaultMobileChildProfilePayload(): CreateMobileChildProfileRequest {
  return {
    label: "Çocuğum",
    ageBand: "toddler_12_24",
    notificationCadence: "monthly"
  };
}

export function getNextMobileReminderDateIso(now = new Date()): string {
  const timezone = "Europe/Istanbul";
  const localDate = getDatePartsInTimezone(now, timezone);

  if (!localDate) {
    const fallback = new Date(now);
    fallback.setUTCDate(fallback.getUTCDate() + 1);
    fallback.setUTCHours(7, 0, 0, 0);
    return fallback.toISOString();
  }

  const nominalUtc = Date.UTC(localDate.year, localDate.month - 1, localDate.day + 1, 10, 0, 0, 0);
  const offsetMinutes = getTimezoneOffsetMinutes(new Date(nominalUtc), timezone);

  return new Date(nominalUtc - offsetMinutes * 60_000).toISOString();
}

function getDatePartsInTimezone(
  date: Date,
  timezone: string
): { year: number; month: number; day: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric"
    }).formatToParts(date);
    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    const day = Number(parts.find((part) => part.type === "day")?.value);

    return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
      ? { year, month, day }
      : null;
  } catch {
    return null;
  }
}

function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric"
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(
    parts.find((part) => part.type === type)?.value
  );
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second")
  );

  return (asUtc - date.getTime()) / 60_000;
}

export function formatCadence(cadence: MobileChildProfileNotificationCadence): string {
  const labels: Record<MobileChildProfileNotificationCadence, string> = {
    off: "Kapalı",
    weekly: "Haftalık",
    monthly: "Aylık",
    yearly: "Yıllık"
  };

  return labels[cadence];
}

function formatNoteType(noteType: MobileChildNote["noteType"]): string {
  const labels: Record<MobileChildNote["noteType"], string> = {
    general: "Genel not",
    feeding: "Beslenme",
    diaper: "Bez",
    sleep: "Uyku",
    activity: "Etkinlik",
    shopping: "Alışveriş",
    health_note: "Sağlık notu",
    size: "Beden / ölçü",
    preference: "Tercih",
    daycare: "Okul / bakım",
    milestone: "Gelişim notu"
  };

  return labels[noteType];
}

function formatReminderValue(reminder: MobileChildReminder): string {
  const date = new Date(reminder.remindAt);
  const formattedDate = Number.isNaN(date.getTime())
    ? reminder.remindAt
    : new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date);

  if (reminder.status === "completed") {
    return `${formattedDate} · Tamamlandı`;
  }

  return formattedDate;
}
