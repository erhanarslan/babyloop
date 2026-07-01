import { buildMobileListingChips } from "./mobile-listing-card-model";

describe("mobile listing card helpers", () => {
  it("builds compact chips in status, type, condition order", () => {
    expect(
      buildMobileListingChips({
        conditionText: "Yeni",
        listingTypeText: "Satılık",
        statusText: "Aktif"
      })
    ).toEqual([
      {
        label: "Aktif",
        tone: "success"
      },
      {
        label: "Satılık",
        tone: "primary"
      },
      {
        label: "Yeni"
      }
    ]);
  });

  it("uses warning tone for reserved listings and omits missing labels", () => {
    expect(
      buildMobileListingChips({
        conditionText: null,
        listingTypeText: "Takas",
        statusText: "Rezerve"
      })
    ).toEqual([
      {
        label: "Rezerve",
        tone: "warning"
      },
      {
        label: "Takas",
        tone: "primary"
      }
    ]);
  });
});
