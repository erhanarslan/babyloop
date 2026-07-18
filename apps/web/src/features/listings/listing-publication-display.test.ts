import { describe, expect, it } from "vitest";

import type { ListingPublicationState } from "../../lib/api";
import {
  getListingPublicationDisplay,
  hasPendingListingPublication,
} from "./listing-publication-display";

const pendingPublicationStates: ListingPublicationState[] = [
  "awaiting_images",
  "ai_review",
  "admin_review",
  "scheduled",
];

describe("listing publication display", () => {
  it.each(pendingPublicationStates)(
    "shows the same public-safe review message for %s",
    (publicationState) => {
      expect(
        getListingPublicationDisplay({
          publicationReviewReason: null,
          publicationState,
          status: "draft",
        }),
      ).toEqual({
        isPending: true,
        needsAttention: false,
        title: "İlanın onay sürecinde",
        message: null,
        tooltip: "Onay bekliyor",
      });
    },
  );

  it("does not present archived drafts as actively waiting for publication", () => {
    expect(
      getListingPublicationDisplay({
        publicationReviewReason: null,
        publicationState: "awaiting_images",
        status: "archived",
      }),
    ).toEqual({
      isPending: false,
      needsAttention: false,
      title: null,
      message: null,
      tooltip: null,
    });
  });

  it("shows the admin reason only when changes are requested", () => {
    expect(
      getListingPublicationDisplay({
        publicationReviewReason: "Ürün açıklamasını netleştir.",
        publicationState: "changes_requested",
        status: "draft",
      }),
    ).toMatchObject({
      needsAttention: true,
      message: "Ürün açıklamasını netleştir.",
    });
  });

  it("detects pending publication lists", () => {
    expect(
      hasPendingListingPublication([
        { publicationReviewReason: null, publicationState: "published", status: "active" },
        { publicationReviewReason: null, publicationState: "scheduled", status: "draft" },
      ]),
    ).toBe(true);
  });
});
