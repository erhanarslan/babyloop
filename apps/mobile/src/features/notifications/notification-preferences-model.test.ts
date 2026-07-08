import {
  canUseMobileNotificationProviderDelivery,
  getMobileNotificationPreferenceChannelSummary,
  canUpdateMobileNotificationCadence,
  getMobileNotificationCadenceUpdateMessage,
  getMobileNotificationPreferenceDeliveryBoundaryText,
  getMobileNotificationPreferenceProfileLabel,
  getPreferredMobileNotificationChildProfile,
  isMobileNotificationCadenceSelected,
  mobileNotificationPreferenceCadenceOptions
} from "./notification-preferences-model";
import type { MobileChildProfile } from "../child/child-reminders-api";
import type { MobileNotificationPreferencesPayload } from "./notifications-api";

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

describe("mobile notification preference model", () => {
  it("selects the active child profile and falls back safely", () => {
    expect(getPreferredMobileNotificationChildProfile([inactiveProfile, activeProfile])?.id).toBe("child-active");
    expect(getPreferredMobileNotificationChildProfile([inactiveProfile])?.id).toBe("child-inactive");
    expect(getPreferredMobileNotificationChildProfile([])).toBeNull();
  });

  it("keeps cadence options explicit and draft-only", () => {
    expect(mobileNotificationPreferenceCadenceOptions.map((option) => option.cadence)).toEqual([
      "monthly",
      "yearly",
      "off"
    ]);
    expect(JSON.stringify(mobileNotificationPreferenceCadenceOptions)).not.toMatch(
      /push gönderildi|email gönderildi|n8n çalıştı|sendPush|sendEmail|webhook/iu
    );
  });

  it("builds privacy-safe delivery and profile labels", () => {
    expect(getMobileNotificationPreferenceDeliveryBoundaryText()).toContain("sunucu provider ayarları");
    expect(getMobileNotificationPreferenceProfileLabel({ isLoading: true, childProfile: activeProfile })).toBe(
      "Yükleniyor..."
    );
    expect(getMobileNotificationPreferenceProfileLabel({ isLoading: false, childProfile: null })).toBe(
      "Aktif çocuk profili yok"
    );
    expect(getMobileNotificationPreferenceProfileLabel({ isLoading: false, childProfile: activeProfile })).toBe(
      "Aktif profil: Ada"
    );
    expect(JSON.stringify({
      delivery: getMobileNotificationPreferenceDeliveryBoundaryText(),
      label: getMobileNotificationPreferenceProfileLabel({ isLoading: false, childProfile: activeProfile })
    })).not.toMatch(/accessToken|refreshToken|passwordHash|email@|phone|rawContact/iu);
  });

  it("formats cadence update messages without claiming real delivery", () => {
    expect(getMobileNotificationCadenceUpdateMessage("monthly")).toBe(
      "Bildirim sıklığı aylık olarak güncellendi."
    );
    expect(getMobileNotificationCadenceUpdateMessage("yearly")).toBe(
      "Bildirim sıklığı yıllık olarak güncellendi."
    );
    expect(getMobileNotificationCadenceUpdateMessage("off")).toBe(
      "Bildirim sıklığı kapalı olarak güncellendi."
    );
    expect(getMobileNotificationCadenceUpdateMessage("monthly")).not.toMatch(/push|email|n8n|gönderildi/iu);
  });

  it("guards cadence updates while loading or without a child profile", () => {
    expect(canUpdateMobileNotificationCadence(activeProfile, false)).toBe(true);
    expect(canUpdateMobileNotificationCadence(activeProfile, true)).toBe(false);
    expect(canUpdateMobileNotificationCadence(null, false)).toBe(false);
    expect(isMobileNotificationCadenceSelected(activeProfile, "monthly")).toBe(true);
    expect(isMobileNotificationCadenceSelected(activeProfile, "off")).toBe(false);
  });

  it("summarizes source/channel preferences without leaking provider data", () => {
    const payload: MobileNotificationPreferencesPayload = {
      preferences: [
        {
          id: "pref-1",
          source: "messages",
          channel: "in_app",
          enabled: true,
          mutedUntil: null,
          quietHoursStart: null,
          quietHoursEnd: null,
          timezone: "Europe/Istanbul",
          digest: "immediate",
          deliveryAllowed: true,
          providerCallAllowed: false,
          draftOnly: false,
          createdAt: "2030-01-01T00:00:00.000Z",
          updatedAt: "2030-01-01T00:00:00.000Z"
        },
        {
          id: "pref-2",
          source: "saved_search",
          channel: "push",
          enabled: false,
          mutedUntil: null,
          quietHoursStart: null,
          quietHoursEnd: null,
          timezone: "Europe/Istanbul",
          digest: "immediate",
          deliveryAllowed: false,
          providerCallAllowed: false,
          draftOnly: true,
          createdAt: "2030-01-01T00:00:00.000Z",
          updatedAt: "2030-01-01T00:00:00.000Z"
        }
      ],
      recentAuditEvents: [],
      summary: {
        deliveryProvidersEnabled: false,
        providerCallsAllowed: false,
        supportedSources: ["messages", "saved_search"],
        supportedChannels: ["in_app", "push", "sms"],
        defaultEnabledChannels: ["in_app"],
        draftOnlyChannels: ["email", "push", "n8n", "sms"],
        disabledChannels: ["sms"]
      }
    };

    expect(getMobileNotificationPreferenceChannelSummary(payload)).toContain("1 tercih aktif");
    expect(getMobileNotificationPreferenceChannelSummary(payload)).toContain("sunucu ayarları");
    expect(getMobileNotificationPreferenceChannelSummary(null)).toBe("Kaynak ve kanal tercihleri yüklenmedi.");
    expect(canUseMobileNotificationProviderDelivery(payload)).toBe(false);
    expect(JSON.stringify(payload)).not.toMatch(/accessToken|refreshToken|passwordHash|rawContact|providerSecret/iu);
  });
});
