import { describe, expect, it } from "vitest";
import {
  buildDefaultWebChildReminderFormState,
  buildWebChildReminderCreatePayloadFromState,
  buildWebChildReminderFormStateFromReminder,
  combineWebChildLocalDateTimeToIso,
  normalizeLocalTime,
  splitIsoToLocalDateTime
} from "./child-reminder-form-model";
import type { ChildProfileReminder } from "./api";

const NOW = new Date("2030-01-01T08:00:00.000Z");

describe("web child reminder form model", () => {
  it.each(["00:00", "09:05", "12:00", "23:59"])(
    "combines local date and %s without invalid date output",
    (time) => {
      const iso = combineWebChildLocalDateTimeToIso("2030-02-03", time);

      expect(iso).toEqual(expect.any(String));
      expect(Number.isNaN(new Date(iso ?? "").getTime())).toBe(false);
      expect(splitIsoToLocalDateTime(iso ?? "").time).toBe(time);
    }
  );

  it("rejects invalid local date and time inputs", () => {
    expect(combineWebChildLocalDateTimeToIso("2030-02-31", "10:00")).toBeNull();
    expect(combineWebChildLocalDateTimeToIso("2030-02-03", "24:00")).toBeNull();
    expect(normalizeLocalTime("not-time")).toBeNull();
  });

  it("builds one-time payload with dueAt and remindAt", () => {
    const result = buildWebChildReminderCreatePayloadFromState(
      {
        ...buildDefaultWebChildReminderFormState(NOW),
        oneTimeDate: "2030-01-02",
        oneTimeTime: "10:00",
        title: "Bez al"
      },
      NOW
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.payload.scheduleKind).toBe("one_time");
      expect(result.payload.dueAt).toBe(result.payload.remindAt);
      expect(splitIsoToLocalDateTime(result.payload.dueAt ?? "")).toMatchObject({
        date: "2030-01-02",
        time: "10:00"
      });
    }
  });

  it("rejects past one-time reminders", () => {
    const result = buildWebChildReminderCreatePayloadFromState(
      {
        ...buildDefaultWebChildReminderFormState(NOW),
        oneTimeDate: "2029-12-30",
        oneTimeTime: "10:00",
        title: "Geçmiş"
      },
      NOW
    );

    expect(result).toEqual({
      ok: false,
      message: "Hatırlatıcı zamanı geçmiş olamaz."
    });
  });

  it("builds daily and weekly payloads with localTime only", () => {
    const daily = buildWebChildReminderCreatePayloadFromState(
      {
        ...buildDefaultWebChildReminderFormState(NOW),
        localTime: "09:05",
        scheduleKind: "daily",
        title: "Günlük"
      },
      NOW
    );
    const weekly = buildWebChildReminderCreatePayloadFromState(
      {
        ...buildDefaultWebChildReminderFormState(NOW),
        localTime: "23:59",
        scheduleKind: "weekly",
        title: "Haftalık"
      },
      NOW
    );

    expect(daily).toMatchObject({
      ok: true,
      payload: {
        localTime: "09:05",
        scheduleKind: "daily"
      }
    });
    expect(weekly).toMatchObject({
      ok: true,
      payload: {
        localTime: "23:59",
        scheduleKind: "weekly"
      }
    });
  });

  it("builds interval and relative-before-event payloads", () => {
    const interval = buildWebChildReminderCreatePayloadFromState(
      {
        ...buildDefaultWebChildReminderFormState(NOW),
        intervalMinutes: "120",
        scheduleKind: "interval",
        title: "Aralıklı"
      },
      NOW
    );
    const relative = buildWebChildReminderCreatePayloadFromState(
      {
        ...buildDefaultWebChildReminderFormState(NOW),
        eventDate: "2030-01-08",
        eventTime: "12:00",
        notifyBeforeMinutes: "1440",
        scheduleKind: "relative_before_event",
        title: "Randevu"
      },
      NOW
    );

    expect(interval).toMatchObject({
      ok: true,
      payload: {
        intervalMinutes: 120,
        scheduleKind: "interval"
      }
    });
    expect(relative).toMatchObject({
      ok: true,
      payload: {
        notifyBeforeMinutes: 1440,
        scheduleKind: "relative_before_event"
      }
    });

    if (relative.ok) {
      expect(splitIsoToLocalDateTime(relative.payload.eventAt ?? "")).toMatchObject({
        date: "2030-01-08",
        time: "12:00"
      });
    }
  });

  it("round-trips existing reminder schedule fields into editable form state", () => {
    const reminder: ChildProfileReminder = {
      cancelledAt: null,
      channel: "in_app",
      childProfileId: "child_1",
      completedAt: null,
      createdAt: "2030-01-01T00:00:00.000Z",
      description: "Randevu notu",
      dueAt: null,
      eventAt: combineWebChildLocalDateTimeToIso("2030-01-08", "21:30"),
      id: "reminder_1",
      intervalMinutes: null,
      lastTriggeredAt: null,
      localTime: null,
      nextRunAt: null,
      notifyBeforeMinutes: 10080,
      remindAt: "2030-01-07T21:30:00.000Z",
      reminderType: "appointment",
      scheduleKind: "relative_before_event",
      status: "scheduled",
      timezone: "Europe/Istanbul",
      title: "Kontrol",
      updatedAt: "2030-01-01T00:00:00.000Z"
    };

    expect(buildWebChildReminderFormStateFromReminder(reminder)).toMatchObject({
      description: "Randevu notu",
      eventDate: "2030-01-08",
      eventTime: "21:30",
      notifyBeforeMinutes: "10080",
      reminderType: "appointment",
      scheduleKind: "relative_before_event",
      title: "Kontrol"
    });
  });
});
