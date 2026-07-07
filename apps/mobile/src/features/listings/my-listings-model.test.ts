import { getMobileListingStatusActions } from "./my-listings-model";

describe("mobile my listings model", () => {
  it("returns release-critical seller actions by listing status", () => {
    expect(getMobileListingStatusActions("active")).toEqual([
      {
        label: "Satıldı",
        status: "sold",
        tone: "primary"
      },
      {
        label: "Yayından kaldır",
        status: "archived",
        tone: "secondary"
      }
    ]);

    expect(getMobileListingStatusActions("reserved").map((action) => action.label)).toEqual([
      "Yayına al",
      "Satıldı",
      "Yayından kaldır"
    ]);

    expect(getMobileListingStatusActions("sold").map((action) => action.label)).toEqual([
      "Yayından kaldır"
    ]);

    expect(getMobileListingStatusActions("archived").map((action) => action.label)).toEqual([
      "Yayına al"
    ]);

    expect(getMobileListingStatusActions("unknown")).toEqual([]);
  });
});
