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
  const next = new Date(now);

  next.setDate(next.getDate() + 1);
  next.setHours(10, 0, 0, 0);

  return next.toISOString();
}

export function formatCadence(cadence: MobileChildProfileNotificationCadence): string {
  const labels: Record<MobileChildProfileNotificationCadence, string> = {
    off: "Kapalı",
    monthly: "Aylık",
    yearly: "Yıllık"
  };

  return labels[cadence];
}

function formatNoteType(noteType: MobileChildNote["noteType"]): string {
  const labels: Record<MobileChildNote["noteType"], string> = {
    general: "Genel not",
    feeding: "Beslenme",
    sleep: "Uyku",
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
