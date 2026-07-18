import {
  filterMobileMyListings,
  getMobileListingPublicationDisplay,
  getMobileListingStatusActionMessage,
  getMobileListingStatusActions,
  hasPendingMobileListingPublication,
  getMobileMyListingStats,
  getMobileMyListingStatusFilterLabel
} from "./my-listings-model";

describe("mobile my listings model", () => {
  it("returns release-critical seller actions by listing status", () => {
    expect(getMobileListingStatusActions("draft")).toEqual([
      {
        label: "Yeniden onaya gönder",
        status: "active",
        tone: "primary"
      }
    ]);

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
      "Yeniden onaya gönder"
    ]);

    expect(getMobileListingStatusActions("unknown")).toEqual([]);
  });

  it.each(["awaiting_images", "ai_review", "admin_review", "scheduled"] as const)(
    "uses the same public-safe review message for %s",
    (publicationState) => {
      expect(
        getMobileListingPublicationDisplay({
          publicationReviewReason: null,
          publicationState,
          status: "draft"
        })
      ).toEqual({
        isPending: true,
        needsAttention: false,
        title: "İlanın onay sürecinde",
        message: null
      });
    }
  );

  it("does not animate archived listings as an active publication review", () => {
    expect(
      getMobileListingPublicationDisplay({
        publicationReviewReason: null,
        publicationState: "awaiting_images",
        status: "archived"
      })
    ).toEqual({
      isPending: false,
      needsAttention: false,
      title: null,
      message: null
    });
  });

  it("detects pending publication rows", () => {
    expect(
      hasPendingMobileListingPublication([
        { publicationReviewReason: null, publicationState: "published", status: "active" },
        { publicationReviewReason: null, publicationState: "scheduled", status: "draft" }
      ])
    ).toBe(true);
  });

  it("filters seller listings by lifecycle status", () => {
    const listings = [
      { id: "draft-1", status: "draft" },
      { id: "active-1", status: "active" },
      { id: "reserved-1", status: "reserved" },
      { id: "sold-1", status: "sold" },
      { id: "archived-1", status: "archived" }
    ];

    expect(filterMobileMyListings(listings, "all").map((listing) => listing.id)).toEqual([
      "draft-1",
      "active-1",
      "reserved-1",
      "sold-1",
      "archived-1"
    ]);
    expect(filterMobileMyListings(listings, "draft")).toEqual([
      { id: "draft-1", status: "draft" }
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
        { status: "draft" },
        { status: "active" },
        { status: "active" },
        { status: "reserved" },
        { status: "sold" },
        { status: "archived" },
        { status: "unknown" }
      ])
    ).toEqual({
      active: 2,
      draft: 1,
      archived: 1,
      reserved: 1,
      sold: 1,
      total: 7
    });
  });

  it("labels filters and mutation success messages", () => {
    expect(getMobileMyListingStatusFilterLabel("all")).toBe("Tümü");
    expect(getMobileMyListingStatusFilterLabel("draft")).toBe("Yayında değil");
    expect(getMobileMyListingStatusFilterLabel("active")).toBe("Yayında");
    expect(getMobileMyListingStatusFilterLabel("reserved")).toBe("Rezerve");
    expect(getMobileListingStatusActionMessage("active", "draft")).toBe(
      "İlanın onay sürecine gönderildi."
    );
    expect(getMobileListingStatusActionMessage("active", "reserved")).toBe(
      "İlan yeniden yayına alındı."
    );
    expect(getMobileListingStatusActionMessage("sold")).toBe("İlan satıldı olarak işaretlendi ve alıcı aksiyonlarına kapatıldı.");
  });
});
