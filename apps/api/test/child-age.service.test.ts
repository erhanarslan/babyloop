import { describe, expect, it } from "vitest";

import {
  completedCalendarMonths,
  deriveChildAgeBand,
  resolveCurrentChildAgeMonths
} from "../src/services/child-age.service.js";

describe("child age service", () => {
  it("advances a manually entered 29-month age to 30 months one month later", () => {
    expect(
      resolveCurrentChildAgeMonths(
        {
          ageMonths: 29,
          ageAsOfDate: new Date("2026-07-19T00:00:00.000Z"),
          birthMonth: null,
          birthYear: null
        },
        new Date("2026-08-19T00:00:00.000Z")
      )
    ).toBe(30);
  });

  it("does not advance before the monthly anniversary", () => {
    expect(
      resolveCurrentChildAgeMonths(
        {
          ageMonths: 29,
          ageAsOfDate: new Date("2026-07-19T00:00:00.000Z"),
          birthMonth: null,
          birthYear: null
        },
        new Date("2026-08-18T23:59:59.000Z")
      )
    ).toBe(29);
  });

  it("handles a month-end anniversary in a leap year", () => {
    expect(
      completedCalendarMonths(
        new Date("2024-01-31T00:00:00.000Z"),
        new Date("2024-02-29T00:00:00.000Z")
      )
    ).toBe(1);
  });

  it("calculates the current age from birth month and year", () => {
    expect(
      resolveCurrentChildAgeMonths(
        {
          ageMonths: null,
          ageAsOfDate: null,
          birthMonth: 2,
          birthYear: 2024
        },
        new Date("2026-08-01T00:00:00.000Z")
      )
    ).toBe(30);
  });

  it("moves lifecycle bands at exact month boundaries", () => {
    expect(deriveChildAgeBand(23)).toBe("toddler_12_24");
    expect(deriveChildAgeBand(24)).toBe("preschool_24_36");
    expect(deriveChildAgeBand(36)).toBe("child_3_plus");
  });
});
