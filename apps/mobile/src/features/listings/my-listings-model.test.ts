import {
  filterMobileMyListings,
  getMobileListingStatusActionMessage,
  getMobileListingStatusActions,
  getMobileMyListingStats,
  getMobileMyListingStatusFilterLabel
} from "./my-listings-model";

describe("mobile my listings model", () => {
  it("returns release-critical seller actions by listing status", () => {
    expect(getMobileListingStatusActions("active")).toEqual([
      {
        label: "Rezerve et",
        status: "reserved",
        tone: "secondary"
      },
      {
        label: "Satıldı olarak işaretle",
        status: "sold",
        tone: "danger"
      },
      {
        label: "Yayından kaldır",
        status: "archived",
        tone: "secondary"
      }
    ]);

    expect(getMobileListingStatusActions("reserved").map((action) => action.label)).toEqual([
      "Yayına al",
      "Satıldı olarak işaretle",
      "Yayından kaldır"
    ]);

    expect(getMobileListingStatusActions("sold").map((action) => action.label)).toEqual([
      "Arşive taşı"
    ]);

    expect(getMobileListingStatusActions("archived").map((action) => action.label)).toEqual([
      "Yeniden yayına al"
    ]);

    expect(getMobileListingStatusActions("unknown")).toEqual([]);
  });

  it("filters seller listings by lifecycle status", () => {
    const listings = [
      { id: "active-1", status: "active" },
      { id: "reserved-1", status: "reserved" },
      { id: "sold-1", status: "sold" },
      { id: "archived-1", status: "archived" }
    ];

    expect(filterMobileMyListings(listings, "all").map((listing) => listing.id)).toEqual([
      "active-1",
      "reserved-1",
      "sold-1",
      "archived-1"
    ]);
    expect(filterMobileMyListings(listings, "active")).toEqual([
      { id: "active-1", status: "active" }
    ]);
    expect(filterMobileMyListings(listings, "archived")).toEqual([
      { id: "archived-1", status: "archived" }
    ]);
  });

  it("summarizes listing lifecycle counts", () => {
    expect(
      getMobileMyListingStats([
        { status: "active" },
        { status: "active" },
        { status: "reserved" },
        { status: "sold" },
        { status: "archived" },
        { status: "unknown" }
      ])
    ).toEqual({
      active: 2,
      archived: 1,
      reserved: 1,
      sold: 1,
      total: 6
    });
  });

  it("labels filters and mutation success messages", () => {
    expect(getMobileMyListingStatusFilterLabel("all")).toBe("Tümü");
    expect(getMobileMyListingStatusFilterLabel("reserved")).toBe("Rezerve");
    expect(getMobileListingStatusActionMessage("active")).toBe("İlan yeniden yayına alındı.");
    expect(getMobileListingStatusActionMessage("sold")).toBe("İlan satıldı olarak işaretlendi ve alıcı aksiyonlarına kapatıldı.");
  });
});
