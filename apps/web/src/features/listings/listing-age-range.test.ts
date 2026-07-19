import { describe, expect, it } from "vitest";
import {
  formatListingAgeRange,
  parseListingAgeRangeFormValue,
  toListingAgeRangeFormValue
} from "./listing-age-range";

describe("listing age range", () => {
  it("maps presets to API min/max payload values", () => {
    expect(parseListingAgeRangeFormValue("independent")).toEqual({
      minMonths: null,
      maxMonths: null
    });
    expect(parseListingAgeRangeFormValue("12:24")).toEqual({
      minMonths: 12,
      maxMonths: 24
    });
    expect(parseListingAgeRangeFormValue("72:216")).toEqual({
      minMonths: 72,
      maxMonths: 216
    });
  });

  it("preserves valid custom ranges while rejecting invalid ranges", () => {
    expect(toListingAgeRangeFormValue(10, 20)).toBe("custom:10:20");
    expect(parseListingAgeRangeFormValue("custom:10:20")).toEqual({
      minMonths: 10,
      maxMonths: 20
    });
    expect(parseListingAgeRangeFormValue("custom:20:10")).toBeNull();
    expect(parseListingAgeRangeFormValue("custom:0:217")).toBeNull();
  });

  it("formats marketplace labels", () => {
    expect(formatListingAgeRange(null, null)).toBe("Yaştan bağımsız");
    expect(formatListingAgeRange(24, 36)).toBe("24–36 ay");
    expect(formatListingAgeRange(72, 216)).toBe("6 yaş ve üzeri");
  });
});
