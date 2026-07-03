import {
  formatCadence,
  getDefaultMobileChildProfilePayload,
  getMobileChildNoteItems,
  getMobileChildReminderItems,
  getMobileChildReminderSettings,
  getNextMobileReminderDateIso
} from "./child-reminders-model";
import type { MobileChildNote, MobileChildReminder } from "./child-reminders-api";

describe("mobile child reminders model", () => {
  it("keeps fallback note cards practical and non-medical", () => {
    const notes = getMobileChildNoteItems();

    expect(notes).toEqual([
      { title: "Beslenme", value: "2 saatte bir" },
      { title: "Bez", value: "Günlük takip" },
      { title: "Etkinlik", value: "Randevu ve oyun" },
      { title: "Alışveriş", value: "Bez, mama, ihtiyaç" }
    ]);
    expect(JSON.stringify(notes)).not.toMatch(/ilaç|tedavi|tanı|terapi|diyet/i);
  });

  it("maps API notes to display cards", () => {
    const apiNotes: MobileChildNote[] = [{
      id: "note-1",
      childProfileId: "child-1",
      noteType: "feeding",
      title: "Kahvaltı",
      body: "Muz seviyor.",
      isArchived: false,
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: "2030-01-01T00:00:00.000Z"
    }];

    expect(getMobileChildNoteItems(apiNotes)).toEqual([
      {
        id: "note-1",
        title: "Kahvaltı",
        value: "Muz seviyor.",
        noteType: "feeding"
      }
    ]);
  });

  it("maps reminders without claiming real push delivery", () => {
    const apiReminders: MobileChildReminder[] = [{
      id: "reminder-1",
      childProfileId: "child-1",
      title: "Bez al",
      description: null,
      remindAt: "2030-01-01T10:00:00.000Z",
      channel: "in_app",
      status: "scheduled",
      completedAt: null,
      cancelledAt: null,
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: "2030-01-01T00:00:00.000Z"
    }];

    const reminders = getMobileChildReminderItems(apiReminders);

    expect(reminders[0]).toMatchObject({
      id: "reminder-1",
      title: "Bez al",
      status: "scheduled"
    });
    expect(JSON.stringify(reminders)).not.toMatch(/push|delivery|servis/i);
  });

  it("exposes notification settings from child cadence", () => {
    expect(getMobileChildReminderSettings({ notificationCadence: "monthly" })[0]).toEqual({
      title: "Çocuk profil önerileri",
      value: "Aylık",
      status: "active"
    });
    expect(formatCadence("off")).toBe("Kapalı");
  });

  it("provides safe default profile and next reminder date", () => {
    expect(getDefaultMobileChildProfilePayload()).toEqual({
      label: "Çocuğum",
      ageBand: "toddler_12_24",
      notificationCadence: "monthly"
    });
    expect(getNextMobileReminderDateIso(new Date("2030-01-01T08:00:00.000Z"))).toBe(
      "2030-01-02T07:00:00.000Z"
    );
  });
});
