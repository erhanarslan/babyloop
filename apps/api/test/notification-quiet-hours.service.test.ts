import { describe, expect, it } from "vitest";
import { isNotificationQuietHoursActive } from "../src/services/notification-preferences.service.js";

describe("notification quiet hours", () => {
  it("blocks only while an overnight window is active in the configured timezone", () => {
    const preference = {
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      timezone: "Europe/Istanbul"
    };

    expect(isNotificationQuietHoursActive(preference, new Date("2030-01-01T20:30:00.000Z"))).toBe(true);
    expect(isNotificationQuietHoursActive(preference, new Date("2030-01-02T03:59:00.000Z"))).toBe(true);
    expect(isNotificationQuietHoursActive(preference, new Date("2030-01-02T04:00:00.000Z"))).toBe(false);
    expect(isNotificationQuietHoursActive(preference, new Date("2030-01-02T11:00:00.000Z"))).toBe(false);
  });

  it("does not mute delivery for incomplete or invalid timezone settings", () => {
    expect(isNotificationQuietHoursActive({
      quietHoursStart: "22:00",
      quietHoursEnd: null,
      timezone: "Europe/Istanbul"
    })).toBe(false);
    expect(isNotificationQuietHoursActive({
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      timezone: "Invalid/Timezone"
    })).toBe(false);
  });
});
