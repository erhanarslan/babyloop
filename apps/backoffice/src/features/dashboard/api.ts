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
    rejectedListingImages: number;
    imagesReviewedLast7Days: number;
  };
  moderation: {
    totalModerationCases: number;
    openModerationCases: number;
    closedModerationCases: number;
    casesCreatedLast7Days: number;
    sensitiveAccessGrantedLast7Days: number;
    sensitiveAccessDeniedLast7Days: number;
  };
  actions: {
    auditEventsLast7Days: number;
    profileEnforcementActionsLast7Days: number;
    listingActionsLast7Days: number;
    imageReviewActionsLast7Days: number;
  };
  profiles: {
    restrictedProfiles: number;
    suspendedProfiles: number;
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
