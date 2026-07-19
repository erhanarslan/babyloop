import {
  buildMobileChildProfileCreatePayload,
  formatMobileChildAge,
  formatMobileChildBirthDate
} from "./child-profile-model";

describe("mobile child profile model", () => {
  it("builds a manual-age profile without inventing a default child age", () => {
    expect(buildMobileChildProfileCreatePayload({
      ageMonths: "29",
      label: "  Ada  "
    })).toEqual({
      ok: true,
      payload: {
        ageBand: "preschool_24_36",
        ageMonths: 29,
        label: "Ada",
        notificationCadence: "monthly"
      }
    });
  });

  it("rejects missing labels and invalid month values", () => {
    expect(buildMobileChildProfileCreatePayload({ ageMonths: "12", label: " " })).toMatchObject({
      ok: false
    });
    expect(buildMobileChildProfileCreatePayload({ ageMonths: "217", label: "Ada" })).toEqual({
      ok: false,
      message: "Yaşı 0–216 arasında tamamlanmış ay olarak yazmalısın."
    });
  });

  it("formats the API-computed current age and birth month safely", () => {
    expect(formatMobileChildAge({ ageBand: "preschool_24_36", ageMonths: 29 })).toBe(
      "2 yaş 5 aylık"
    );
    expect(formatMobileChildBirthDate({ birthMonth: 5, birthYear: 2024 })).toBe("Mayıs 2024");
    expect(formatMobileChildBirthDate({ birthMonth: null, birthYear: null })).toBeNull();
  });
});
