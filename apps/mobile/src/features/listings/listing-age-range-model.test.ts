import {
  formatMobileListingAgeRange,
  parseMobileListingAgeRange,
  toMobileListingAgeRangeValue
} from "./listing-age-range-model";

describe("mobile listing age range model", () => {
  it("parses supported presets and the age-independent value", () => {
    expect(parseMobileListingAgeRange("12:24")).toEqual({
      minMonths: 12,
      maxMonths: 24
    });
    expect(parseMobileListingAgeRange("independent")).toEqual({
      minMonths: null,
      maxMonths: null
    });
  });

  it("preserves valid custom API ranges and rejects invalid pairs", () => {
    expect(toMobileListingAgeRangeValue(18, 30)).toBe("custom:18:30");
    expect(parseMobileListingAgeRange("custom:18:30")).toEqual({
      minMonths: 18,
      maxMonths: 30
    });
    expect(parseMobileListingAgeRange("custom:30:18")).toBeNull();
    expect(parseMobileListingAgeRange("custom:0:217")).toBeNull();
    expect(parseMobileListingAgeRange("broken")).toBeNull();
  });

  it("formats compact Turkish age labels", () => {
    expect(formatMobileListingAgeRange(null, null)).toBe("Yaştan bağımsız");
    expect(formatMobileListingAgeRange(6, 12)).toBe("6–12 ay");
    expect(formatMobileListingAgeRange(48, 72)).toBe("4–6 yaş");
  });
});
