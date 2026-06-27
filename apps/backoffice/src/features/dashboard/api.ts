import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type AdminDashboardSummary = {
  listings: {
    totalListings: number;
    activeListings: number;
    archivedListings: number;
    soldListings: number;
    reservedListings: number;
    draftListings: number;
    listingsCreatedLast7Days: number;
    listingsUpdatedLast7Days: number;
    listingsWithRejectedImages: number;
  };
  images: {
    totalListingImages: number;
    approvedListingImages: number;
    needsReviewListingImages: number;
    rejectedListingImages: number;
    imagesReviewedLast7Days: number;
  };
  moderation: {
    totalModerationCases: number;
    openModerationCases: number;
    closedModerationCases: number;
    casesCreatedLast7Days: number;
    openHighPriorityCases: number;
    openNormalPriorityCases: number;
    openLowPriorityCases: number;
    pendingReports: number;
    reportsCreatedLast7Days: number;
    sensitiveAccessGrantedLast7Days: number;
    sensitiveAccessDeniedLast7Days: number;
  };
  actions: {
    auditEventsLast7Days: number;
    profileEnforcementActionsLast7Days: number;
    listingActionsLast7Days: number;
    imageReviewActionsLast7Days: number;
    messageEnforcementActionsLast7Days: number;
  };
  profiles: {
    restrictedProfiles: number;
    suspendedProfiles: number;
    highRiskProfiles: number;
    criticalRiskProfiles: number;
    profilesNeedingReview: number;
  };
  conversations: {
    totalConversations: number;
    conversationsCreatedLast7Days: number;
    messagesCreatedLast7Days: number;
    reportedMessageCount: number;
    openMessageCases: number;
  };
  ai: {
    moderationSummaryRunsLast7Days: number;
    moderationSummaryFailuresLast7Days: number;
    providerFailuresLast7Days: number;
    validationFailuresLast7Days: number;
  };
};

export type AdminDashboardSummaryResponse = {
  summary: AdminDashboardSummary;
};

export async function getAdminDashboardSummary(): Promise<
  ApiResponse<AdminDashboardSummaryResponse>
> {
  try {
    const response = await authFetch(
      getApiBaseUrl(),
      "/api/v1/admin/dashboard/summary",
    );

    return (await response.json()) as ApiResponse<AdminDashboardSummaryResponse>;
  } catch {
    return {
      ok: false,
      error: {
        code: "BACKOFFICE_REQUEST_FAILED",
        message: "Backoffice request failed.",
      },
    };
  }
}
