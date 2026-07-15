import {
  formatMobileChildFriendlyDateTimeInput,
  formatMobileChildLocalTimeFromDate,
  getMobileChildDateTimePickerDate,
  getMobileChildLocalTimePickerDate,
  isMobileChildLocalTimeInput,
  mergeMobileChildDateTimePickerValue,
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
});
