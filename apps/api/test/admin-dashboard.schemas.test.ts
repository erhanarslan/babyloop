import { describe, expect, it } from "vitest";
import { adminDashboardSummaryResponseSchema } from "../src/schemas/admin-dashboard.schemas.js";

function createDashboardSummaryPayload() {
  return {
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
      approvedListingImages: 9,
      needsReviewListingImages: 1,
      rejectedListingImages: 2,
      imagesReviewedLast7Days: 4
    },
    moderation: {
      totalModerationCases: 5,
      openModerationCases: 2,
      closedModerationCases: 3,
      openHighPriorityCases: 1,
      openNormalPriorityCases: 1,
      openLowPriorityCases: 0,
      casesCreatedLast7Days: 1,
      pendingReports: 3,
      reportsCreatedLast7Days: 2,
      sensitiveAccessGrantedLast7Days: 1,
      sensitiveAccessDeniedLast7Days: 1
    },
    actions: {
      auditEventsLast7Days: 7,
      profileEnforcementActionsLast7Days: 1,
      listingActionsLast7Days: 2,
      imageReviewActionsLast7Days: 3,
      messageEnforcementActionsLast7Days: 1
    },
    profiles: {
      restrictedProfiles: 1,
      suspendedProfiles: 1,
      highRiskProfiles: 1,
      criticalRiskProfiles: 0,
      profilesNeedingReview: 3
    },
    conversations: {
      totalConversations: 8,
      conversationsCreatedLast7Days: 2,
      messagesCreatedLast7Days: 11,
      reportedMessageCount: 3,
      openMessageCases: 1
    },
    ai: {
      moderationSummaryRunsLast7Days: 4,
      moderationSummaryFailuresLast7Days: 1,
      providerFailuresLast7Days: 1,
      validationFailuresLast7Days: 0
    }
  };
}

describe("admin dashboard schemas", () => {
  it("accepts aggregate-only dashboard monitoring data", () => {
    const parsed = adminDashboardSummaryResponseSchema.safeParse(createDashboardSummaryPayload());

    expect(parsed.success).toBe(true);
  });

  it("rejects identity-like fields in dashboard summary data", () => {
    const payload = createDashboardSummaryPayload();

    const parsed = adminDashboardSummaryResponseSchema.safeParse({
      ...payload,
      listings: {
        ...payload.listings,
        sellerEmail: "seller@example.com"
      }
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects raw message fields in dashboard monitoring data", () => {
    const payload = createDashboardSummaryPayload();

    const parsed = adminDashboardSummaryResponseSchema.safeParse({
      ...payload,
      conversations: {
        ...payload.conversations,
        messageBody: "raw buyer/seller conversation body"
      }
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects raw AI payload fields in dashboard monitoring data", () => {
    const payload = createDashboardSummaryPayload();

    const parsed = adminDashboardSummaryResponseSchema.safeParse({
      ...payload,
      ai: {
        ...payload.ai,
        input: { rawReason: "private report reason" },
        output: { rawSummary: "model output" }
      }
    });

    expect(parsed.success).toBe(false);
  });
});
