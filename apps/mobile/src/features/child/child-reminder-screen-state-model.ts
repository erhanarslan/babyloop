import type {
  CreateMobileChildNoteRequest,
  CreateMobileChildReminderRequest,
  MobileChildNote,
  MobileChildProfile,
  MobileChildReminder
} from "./child-reminders-api";
import { getNextMobileReminderDateIso } from "./child-reminders-model";

export type MobileChildReminderMutationKind =
  | "note_created"
  | "note_archived"
  | "reminder_created"
  | "reminder_completed"
  | "reminder_cancelled";

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
    note_archived: "Not arşivlendi.",
    reminder_created: "Hatırlatıcı eklendi.",
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

export function buildMobileChildNoteCreatePayload(title: string): CreateMobileChildNoteRequest {
  return {
    noteType: "general",
    title: normalizeMobileChildEntryTitle(title),
    body: null
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
    timezone: "Europe/Istanbul",
    channel: "in_app"
  };
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
