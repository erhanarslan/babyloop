import {
  appendMobileChildReminder,
  buildMobileChildNoteCreatePayload,
  buildMobileChildReminderCreatePayload,
  canRunMobileChildProfileAction,
  getMobileChildDeliveryBoundaryText,
  getMobileChildMutationMessage,
  getMobileChildProfileMetaLabel,
  getMobileChildRequiredTitleMessage,
  getPreferredMobileChildProfile,
  normalizeMobileChildEntryTitle,
  prependMobileChildNote,
  removeMobileChildNote,
  removeMobileChildReminder,
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
  isArchived: false,
  createdAt: "2030-01-01T00:00:00.000Z",
  updatedAt: "2030-01-01T00:00:00.000Z"
};

const reminder: MobileChildReminder = {
  id: "reminder-1",
  childProfileId: "child-active",
  title: "Bez al",
  description: null,
  remindAt: "2030-01-02T07:00:00.000Z",
  channel: "in_app",
  status: "scheduled",
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

  it("normalizes titles and builds note payloads without leaking secrets", () => {
    const payload = buildMobileChildNoteCreatePayload("  Bez stoğu azaldı accessToken=secret  ");

    expect(normalizeMobileChildEntryTitle("  Not  ")).toBe("Not");
    expect(payload).toEqual({
      noteType: "general",
      title: "Bez stoğu azaldı accessToken=secret",
      body: null
    });
    expect(JSON.stringify({ payload })).not.toMatch(/refreshToken|passwordHash|currentPassword|rawContact/iu);
  });

  it("builds in-app reminder payloads without claiming push, email, or n8n delivery", () => {
    const payload = buildMobileChildReminderCreatePayload("  Yarın bez al  ", new Date("2030-01-01T08:00:00.000Z"));

    expect(payload).toEqual({
      title: "Yarın bez al",
      remindAt: "2030-01-02T07:00:00.000Z",
      channel: "in_app"
    });
    expect(JSON.stringify(payload)).not.toMatch(/sendPush|sendEmail|n8n|webhook|push gönderildi|email gönderildi/iu);
  });

  it("keeps copy and messages practical, non-medical, and no-real-delivery", () => {
    const copy = [
      getMobileChildDeliveryBoundaryText(),
      getMobileChildProfileMetaLabel(true),
      getMobileChildProfileMetaLabel(false),
      getMobileChildRequiredTitleMessage("note"),
      getMobileChildRequiredTitleMessage("reminder"),
      getMobileChildMutationMessage("note_created"),
      getMobileChildMutationMessage("note_archived"),
      getMobileChildMutationMessage("reminder_created"),
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
    expect(removeMobileChildNote([note], "note-1")).toEqual([]);
    expect(appendMobileChildReminder([], reminder)).toEqual([reminder]);
    expect(replaceMobileChildReminder([reminder], "reminder-1", completedReminder)).toEqual([completedReminder]);
    expect(removeMobileChildReminder([reminder], "reminder-1")).toEqual([]);
  });
});
