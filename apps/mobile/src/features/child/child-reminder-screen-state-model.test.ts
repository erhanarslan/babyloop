import {
  appendMobileChildReminder,
  buildMobileChildNoteCreatePayload,
  buildMobileChildNoteCreatePayloadFromState,
  buildMobileChildReminderCreatePayload,
  buildMobileChildReminderCreatePayloadFromState,
  canRunMobileChildProfileAction,
  createMobileChildNoteFormState,
  createMobileChildReminderFormState,
  createMobileChildReminderFormStateFromReminder,
  getMobileChildDeliveryBoundaryText,
  getMobileChildMutationMessage,
  getMobileChildProfileMetaLabel,
  getMobileChildReminderScheduleLabel,
  getMobileChildRequiredTitleMessage,
  getPreferredMobileChildProfile,
  normalizeMobileChildEntryTitle,
  prependMobileChildNote,
  removeMobileChildNote,
  removeMobileChildReminder,
  replaceMobileChildNote,
  replaceMobileChildReminder
} from "./child-reminder-screen-state-model";
import type { MobileChildNote, MobileChildProfile, MobileChildReminder } from "./child-reminders-api";

const inactiveProfile: MobileChildProfile = {
  id: "child-inactive",
  label: "Eski profil",
  ageBand: "infant_6_12",
  ageMonths: null,
  birthMonth: null,
  birthYear: null,
  gender: null,
  notificationCadence: "off",
  isActive: false,
  createdAt: "2030-01-01T00:00:00.000Z",
  updatedAt: "2030-01-01T00:00:00.000Z"
};

const activeProfile: MobileChildProfile = {
  ...inactiveProfile,
  id: "child-active",
  label: "Ada",
  notificationCadence: "monthly",
  isActive: true
};

const note: MobileChildNote = {
  id: "note-1",
  childProfileId: "child-active",
  noteType: "general",
  title: "Bez",
  body: null,
  isPinned: false,
  isArchived: false,
  createdAt: "2030-01-01T00:00:00.000Z",
  updatedAt: "2030-01-01T00:00:00.000Z"
};

const reminder: MobileChildReminder = {
  id: "reminder-1",
  childProfileId: "child-active",
  title: "Bez al",
  description: null,
  reminderType: "shopping",
  scheduleKind: "one_time",
  intervalMinutes: null,
  dueAt: "2030-01-02T07:00:00.000Z",
  eventAt: null,
  notifyBeforeMinutes: null,
  localTime: null,
  timezone: "Europe/Istanbul",
  remindAt: "2030-01-02T07:00:00.000Z",
  channel: "in_app",
  nextRunAt: "2030-01-02T07:00:00.000Z",
  status: "scheduled",
  lastTriggeredAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: "2030-01-01T00:00:00.000Z",
  updatedAt: "2030-01-01T00:00:00.000Z"
};

describe("mobile child reminder screen-state model", () => {
  it("selects an active child profile and falls back safely", () => {
    expect(getPreferredMobileChildProfile([inactiveProfile, activeProfile])?.id).toBe("child-active");
    expect(getPreferredMobileChildProfile([inactiveProfile])?.id).toBe("child-inactive");
    expect(getPreferredMobileChildProfile([])).toBeNull();
  });

  it("guards child actions while submitting or without profile", () => {
    expect(canRunMobileChildProfileAction(activeProfile, false)).toBe(true);
    expect(canRunMobileChildProfileAction(activeProfile, true)).toBe(false);
    expect(canRunMobileChildProfileAction(null, false)).toBe(false);
  });

  it("normalizes titles and builds legacy note payloads without leaking secrets", () => {
    const payload = buildMobileChildNoteCreatePayload("  Bez stoğu azaldı accessToken=secret  ");

    expect(normalizeMobileChildEntryTitle("  Not  ")).toBe("Not");
    expect(payload).toEqual({
      noteType: "general",
      title: "Bez stoğu azaldı accessToken=secret",
      body: null
    });
    expect(JSON.stringify({ payload })).not.toMatch(/refreshToken|passwordHash|currentPassword|rawContact/iu);
  });

  it("builds rich note payloads from form state", () => {
    expect(createMobileChildNoteFormState({
      ...note,
      body: "2 paket kaldı.",
      noteType: "diaper"
    })).toEqual({
      body: "2 paket kaldı.",
      noteType: "diaper",
      title: "Bez"
    });

    expect(buildMobileChildNoteCreatePayloadFromState({
      body: "  2 paket kaldı.  ",
      noteType: "diaper",
      title: "  Bez stoğu  "
    })).toEqual({
      ok: true,
      payload: {
        body: "2 paket kaldı.",
        noteType: "diaper",
        title: "Bez stoğu"
      }
    });

    expect(buildMobileChildNoteCreatePayloadFromState({
      body: "",
      noteType: "general",
      title: "  "
    })).toEqual({
      ok: false,
      message: "Not başlığı gerekli."
    });
  });

  it("builds in-app reminder payloads without claiming push, email, or n8n delivery", () => {
    const payload = buildMobileChildReminderCreatePayload("  Yarın bez al  ", new Date("2030-01-01T08:00:00.000Z"));

    expect(payload).toEqual({
      title: "Yarın bez al",
      reminderType: "shopping",
      scheduleKind: "one_time",
      dueAt: "2030-01-02T07:00:00.000Z",
      remindAt: "2030-01-02T07:00:00.000Z",
      timezone: "Europe/Istanbul",
      channel: "in_app"
    });
    expect(JSON.stringify(payload)).not.toMatch(/sendPush|sendEmail|n8n|webhook|push gönderildi|email gönderildi/iu);
  });

  it("builds interval, weekly, and appointment reminder payloads from form state", () => {
    expect(buildMobileChildReminderCreatePayloadFromState({
      ...createMobileChildReminderFormState("feeding_interval"),
      intervalMinutes: "120"
    })).toEqual({
      ok: true,
      payload: expect.objectContaining({
        channel: "in_app",
        intervalMinutes: 120,
        reminderType: "feeding",
        scheduleKind: "interval",
        title: "Beslenme zamanı"
      })
    });

    expect(buildMobileChildReminderCreatePayloadFromState({
      ...createMobileChildReminderFormState("activity_weekly"),
      localTime: "10:30"
    })).toEqual({
      ok: true,
      payload: expect.objectContaining({
        channel: "in_app",
        localTime: "10:30",
        scheduleKind: "weekly"
      })
    });

    const appointmentPayload = buildMobileChildReminderCreatePayloadFromState({
      ...createMobileChildReminderFormState("appointment", new Date("2030-01-01T08:00:00.000Z")),
      notifyBeforeMinutes: "1440"
    });

    expect(appointmentPayload).toEqual({
      ok: true,
      payload: expect.objectContaining({
        channel: "in_app",
        notifyBeforeMinutes: 1440,
        reminderType: "appointment",
        scheduleKind: "relative_before_event"
      })
    });
    expect(JSON.stringify(appointmentPayload)).not.toMatch(/ilaç|tedavi|tanı|terapi|diyet reçetesi|push gönderildi|email gönderildi|n8n çalıştı/iu);
  });

  it("validates rich reminder form state", () => {
    expect(buildMobileChildReminderCreatePayloadFromState({
      ...createMobileChildReminderFormState("feeding_interval"),
      intervalMinutes: "5"
    })).toEqual({
      ok: false,
      message: "Tekrarlı hatırlatıcı için en az 15 dakika aralık yaz."
    });

    expect(buildMobileChildReminderCreatePayloadFromState({
      ...createMobileChildReminderFormState("activity_weekly"),
      localTime: "not-time"
    })).toEqual({
      ok: false,
      message: "Günlük/haftalık hatırlatıcı için HH:mm formatında saat yaz."
    });
  });

  it("creates reminder form state from existing reminders and labels schedules", () => {
    expect(createMobileChildReminderFormStateFromReminder({
      ...reminder,
      intervalMinutes: 120,
      scheduleKind: "interval"
    })).toMatchObject({
      intervalMinutes: "120",
      reminderType: "shopping",
      scheduleKind: "interval"
    });

    expect(getMobileChildReminderScheduleLabel({
      intervalMinutes: 120,
      localTime: null,
      notifyBeforeMinutes: null,
      scheduleKind: "interval"
    })).toBe("120 dakikada bir");

    expect(getMobileChildReminderScheduleLabel({
      intervalMinutes: null,
      localTime: "10:00",
      notifyBeforeMinutes: null,
      scheduleKind: "weekly"
    })).toBe("Haftalık 10:00");
  });

  it("keeps copy and messages practical, non-medical, and no-real-delivery", () => {
    const copy = [
      getMobileChildDeliveryBoundaryText(),
      getMobileChildProfileMetaLabel(true),
      getMobileChildProfileMetaLabel(false),
      getMobileChildRequiredTitleMessage("note"),
      getMobileChildRequiredTitleMessage("reminder"),
      getMobileChildMutationMessage("note_created"),
      getMobileChildMutationMessage("note_updated"),
      getMobileChildMutationMessage("note_archived"),
      getMobileChildMutationMessage("reminder_created"),
      getMobileChildMutationMessage("reminder_updated"),
      getMobileChildMutationMessage("reminder_completed"),
      getMobileChildMutationMessage("reminder_cancelled")
    ];

    expect(copy).toContain("Günlük notlar ve uygulama içi hatırlatıcılar burada toplanır.");
    expect(copy).toContain("Yükleniyor...");
    expect(copy).toContain("API bağlantılı");
    expect(JSON.stringify(copy)).not.toMatch(/ilaç|tedavi|tanı|terapi|diyet reçetesi|push gönderildi|email gönderildi|n8n çalıştı/iu);
  });

  it("updates local note and reminder collections deterministically", () => {
    const completedReminder: MobileChildReminder = {
      ...reminder,
      status: "completed",
      completedAt: "2030-01-02T07:01:00.000Z"
    };

    expect(prependMobileChildNote([], note)).toEqual([note]);
    expect(replaceMobileChildNote([note], "note-1", { ...note, title: "Güncel not" })).toEqual([
      { ...note, title: "Güncel not" }
    ]);
    expect(removeMobileChildNote([note], "note-1")).toEqual([]);
    expect(appendMobileChildReminder([], reminder)).toEqual([reminder]);
    expect(replaceMobileChildReminder([reminder], "reminder-1", completedReminder)).toEqual([completedReminder]);
    expect(removeMobileChildReminder([reminder], "reminder-1")).toEqual([]);
  });
});
