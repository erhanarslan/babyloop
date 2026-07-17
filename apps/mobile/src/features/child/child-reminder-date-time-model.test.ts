import {
  buildMobileChildReminderCreatePayloadFromState,
  createMobileChildReminderFormState,
  formatMobileChildFriendlyDateTimeInput,
  formatMobileChildLocalTimeFromDate,
  getMobileChildDateTimePickerDate,
  getMobileChildLocalTimePickerDate,
  isMobileChildLocalTimeInput,
  mergeMobileChildDateTimePickerEventValue,
  mergeMobileChildDateTimePickerValue,
  mergeMobileChildLocalTimePickerEventValue,
  parseMobileChildFriendlyDateTimeInput
} from "./child-reminder-screen-state-model";

describe("mobile child reminder date time model", () => {
  it("formats and parses friendly date time input without exposing ISO as the primary UX", () => {
    const iso = new Date(2030, 0, 2, 10, 0, 0, 0).toISOString();

    expect(formatMobileChildFriendlyDateTimeInput(iso)).toBe("2030-01-02 10:00");
    expect(parseMobileChildFriendlyDateTimeInput("2030-01-02 10:00")).toBe(iso);
  });

  it("merges native date and time picker selections into one ISO value", () => {
    const currentValue = new Date(2030, 0, 2, 10, 0, 0, 0).toISOString();
    const nextDate = mergeMobileChildDateTimePickerValue({
      currentValue,
      fallbackKind: "due",
      mode: "date",
      selectedDate: new Date(2030, 1, 3, 21, 45, 0, 0)
    });
    const nextTime = mergeMobileChildDateTimePickerValue({
      currentValue: nextDate,
      fallbackKind: "due",
      mode: "time",
      selectedDate: new Date(2040, 5, 6, 8, 30, 0, 0)
    });

    expect(formatMobileChildFriendlyDateTimeInput(nextDate)).toBe("2030-02-03 10:00");
    expect(formatMobileChildFriendlyDateTimeInput(nextTime)).toBe("2030-02-03 08:30");
  });

  it("uses a practical fallback date when the current value is empty", () => {
    const fallback = getMobileChildDateTimePickerDate("", "due", new Date(2030, 0, 1, 9, 0, 0, 0));

    expect(formatMobileChildFriendlyDateTimeInput(fallback.toISOString())).toBe("2030-01-02 10:00");
  });

  it("formats and validates local time for daily and weekly reminders", () => {
    expect(formatMobileChildLocalTimeFromDate(new Date(2030, 0, 1, 7, 5, 0, 0))).toBe("07:05");
    expect(getMobileChildLocalTimePickerDate("21:30", new Date(2030, 0, 1, 9, 0, 0, 0)).getHours()).toBe(21);
    expect(isMobileChildLocalTimeInput("10:00")).toBe(true);
    expect(isMobileChildLocalTimeInput("25:00")).toBe(false);
  });

  it.each([
    [0, 0, "00:00"],
    [9, 5, "09:05"],
    [12, 0, "12:00"],
    [23, 59, "23:59"]
  ])("keeps local picker time %s:%s as HH:mm", (hour, minute, expected) => {
    expect(formatMobileChildLocalTimeFromDate(new Date(2030, 0, 1, hour, minute, 0, 0))).toBe(expected);
  });

  it("does not change date-time state when the native picker is dismissed", () => {
    const currentValue = new Date(2030, 0, 2, 10, 0, 0, 0).toISOString();

    expect(mergeMobileChildDateTimePickerEventValue({
      currentValue,
      eventType: "dismissed",
      fallbackKind: "due",
      mode: "time",
      selectedDate: new Date(2030, 0, 2, 23, 59, 0, 0)
    })).toBe(currentValue);
    expect(mergeMobileChildLocalTimePickerEventValue({
      currentValue: "10:00",
      eventType: "dismissed",
      selectedDate: new Date(2030, 0, 2, 23, 59, 0, 0)
    })).toBe("10:00");
  });

  it("builds one-time, daily, weekly, and event-relative reminders from native picker values", () => {
    const oneTimeDueAt = mergeMobileChildDateTimePickerValue({
      currentValue: "",
      fallbackKind: "due",
      mode: "date",
      now: new Date(2030, 0, 1, 9, 0, 0, 0),
      selectedDate: new Date(2030, 0, 5, 22, 20, 0, 0)
    });
    const oneTimeAtNoon = mergeMobileChildDateTimePickerValue({
      currentValue: oneTimeDueAt,
      fallbackKind: "due",
      mode: "time",
      selectedDate: new Date(2030, 0, 1, 12, 0, 0, 0)
    });

    expect(buildMobileChildReminderCreatePayloadFromState({
      ...createMobileChildReminderFormState("shopping", new Date(2030, 0, 1, 9, 0, 0, 0)),
      dueAt: oneTimeAtNoon
    })).toEqual({
      ok: true,
      payload: expect.objectContaining({
        dueAt: oneTimeAtNoon,
        remindAt: oneTimeAtNoon,
        scheduleKind: "one_time"
      })
    });

    expect(buildMobileChildReminderCreatePayloadFromState({
      ...createMobileChildReminderFormState("activity_weekly"),
      scheduleKind: "daily",
      localTime: mergeMobileChildLocalTimePickerEventValue({
        currentValue: "10:00",
        eventType: "set",
        selectedDate: new Date(2030, 0, 1, 9, 5, 0, 0)
      })
    })).toEqual({
      ok: true,
      payload: expect.objectContaining({
        localTime: "09:05",
        scheduleKind: "daily"
      })
    });

    expect(buildMobileChildReminderCreatePayloadFromState({
      ...createMobileChildReminderFormState("activity_weekly"),
      localTime: "23:59"
    })).toEqual({
      ok: true,
      payload: expect.objectContaining({
        localTime: "23:59",
        scheduleKind: "weekly"
      })
    });

    const eventAt = mergeMobileChildDateTimePickerValue({
      currentValue: "",
      fallbackKind: "event",
      mode: "time",
      now: new Date(2030, 0, 1, 9, 0, 0, 0),
      selectedDate: new Date(2030, 0, 1, 21, 30, 0, 0)
    });

    expect(buildMobileChildReminderCreatePayloadFromState({
      ...createMobileChildReminderFormState("appointment", new Date(2030, 0, 1, 9, 0, 0, 0)),
      eventAt,
      notifyBeforeMinutes: "1440"
    })).toEqual({
      ok: true,
      payload: expect.objectContaining({
        eventAt,
        notifyBeforeMinutes: 1440,
        scheduleKind: "relative_before_event"
      })
    });
  });

  it("rejects invalid friendly date inputs and invalid local times", () => {
    expect(parseMobileChildFriendlyDateTimeInput("not-a-date")).toBeNull();
    expect(isMobileChildLocalTimeInput("24:00")).toBe(false);
    expect(isMobileChildLocalTimeInput("09:60")).toBe(false);
  });

  it("rejects past one-time reminder dates before they reach the API", () => {
    expect(buildMobileChildReminderCreatePayloadFromState({
      ...createMobileChildReminderFormState("shopping"),
      dueAt: "2000-01-01T10:00:00.000Z"
    })).toEqual({
      ok: false,
      message: "Hatırlatıcı zamanı geçmiş olamaz."
    });
  });
});
