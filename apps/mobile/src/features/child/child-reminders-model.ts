export type MobileChildNoteItem = {
  title: string;
  value: string;
};

export type MobileChildReminderItem = string;

export type MobileChildReminderSetting = {
  title: string;
  value: string;
};

const childNoteItems = [
  { title: "Beslenme", value: "2 saatte bir" },
  { title: "Bez", value: "Günlük takip" },
  { title: "Etkinlik", value: "Randevu ve oyun" },
  { title: "Alışveriş", value: "Bez, mama, ihtiyaç" }
] as const satisfies readonly MobileChildNoteItem[];

const childReminderItems = [
  "Hafta sonu bez al",
  "Havuz etkinliği için 1 hafta önce hatırlat",
  "Uyku düzenini akşam not et"
] as const satisfies readonly MobileChildReminderItem[];

const childReminderSettings = [
  { title: "Beslenme", value: "2 saatte bir" },
  { title: "Bez takibi", value: "Günlük" },
  { title: "Etkinlik", value: "1 hafta ve 1 gün önce" },
  { title: "Alışveriş", value: "Seçilen gün sabah 10:00" }
] as const satisfies readonly MobileChildReminderSetting[];

export function getMobileChildNoteItems(): MobileChildNoteItem[] {
  return [...childNoteItems];
}

export function getMobileChildReminderItems(): MobileChildReminderItem[] {
  return [...childReminderItems];
}

export function getMobileChildReminderSettings(): MobileChildReminderSetting[] {
  return [...childReminderSettings];
}
