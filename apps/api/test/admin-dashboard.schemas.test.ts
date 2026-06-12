import { describe, expect, it } from "vitest";
import { adminDashboardSummaryResponseSchema } from "../src/schemas/admin-dashboard.schemas.js";

describe("admin dashboard schemas", () => {
  it("accepts aggregate-only dashboard summary data", () => {
    const parsed = adminDashboardSummaryResponseSchema.safeParse({
      listings: {
        totalListings: 10,
        activeListings: 6,
        archivedListings: 1,
        soldListings: 1,
        reservedListings: 1,
        draftListings: 1,
        listingsCreatedLast7Days: 2,
        listingsUpdatedLast7Days: 3,
        listingsWithRejectedImages: 1
      },
      images: {
        totalListingImages: 12,
        approvedListingImages: 10,
        rejectedListingImages: 2,
        imagesReviewedLast7Days: 4
      },
      moderation: {
        totalModerationCases: 5,
        openModerationCases: 2,
        closedModerationCases: 3,
        casesCreatedLast7Days: 1,
        sensitiveAccessGrantedLast7Days: 1,
        sensitiveAccessDeniedLast7Days: 1
      },
      actions: {
        auditEventsLast7Days: 7,
        profileEnforcementActionsLast7Days: 1,
        listingActionsLast7Days: 2,
        imageReviewActionsLast7Days: 3
      },
      profiles: {
        restrictedProfiles: 1,
        suspendedProfiles: 1
      }
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects identity-like fields in dashboard summary data", () => {
    const parsed = adminDashboardSummaryResponseSchema.safeParse({
      listings: {
        totalListings: 10,
        activeListings: 6,
        archivedListings: 1,
        soldListings: 1,
        reservedListings: 1,
        draftListings: 1,
        listingsCreatedLast7Days: 2,
        listingsUpdatedLast7Days: 3,
        listingsWithRejectedImages: 1,
        sellerEmail: "seller@example.com"
      },
      images: {
        totalListingImages: 12,
        approvedListingImages: 10,
        rejectedListingImages: 2,
        imagesReviewedLast7Days: 4
      },
      moderation: {
        totalModerationCases: 5,
        openModerationCases: 2,
        closedModerationCases: 3,
        casesCreatedLast7Days: 1,
        sensitiveAccessGrantedLast7Days: 1,
        sensitiveAccessDeniedLast7Days: 1
      },
      actions: {
        auditEventsLast7Days: 7,
        profileEnforcementActionsLast7Days: 1,
        listingActionsLast7Days: 2,
        imageReviewActionsLast7Days: 3
      },
      profiles: {
        restrictedProfiles: 1,
        suspendedProfiles: 1
      }
    });

    expect(parsed.success).toBe(false);
  });
});
