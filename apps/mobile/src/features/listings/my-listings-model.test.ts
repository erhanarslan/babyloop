import { getMobileListingStatusActions } from "./my-listings-model";

describe("mobile my listings model", () => {
  it("returns release-critical seller actions by listing status", () => {
    expect(getMobileListingStatusActions("active")).toEqual([
      {
        label: "Satıldı yap",
        status: "sold",
        tone: "primary"
      },
      {
        label: "Arşivle",
        status: "archived",
        tone: "secondary"
      }
    ]);

    expect(getMobileListingStatusActions("reserved").map((action) => action.label)).toEqual([
      "Aktife al",
      "Satıldı yap",
      "Arşivle"
    ]);

    expect(getMobileListingStatusActions("sold").map((action) => action.label)).toEqual([
      "Arşivle"
    ]);

    expect(getMobileListingStatusActions("archived").map((action) => action.label)).toEqual([
      "Yeniden aktif et"
    ]);

    expect(getMobileListingStatusActions("unknown")).toEqual([]);
  });
});
