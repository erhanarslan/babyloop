import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type AdminListingStatus =
  | "draft"
  | "active"
  | "reserved"
  | "sold"
  | "archived";

export type AdminListingSort =
  | "newest"
  | "oldest"
  | "updated_desc"
  | "updated_asc";

export type AdminListingAction = "archive" | "restore" | "publish" | "request_changes";
export type AdminListingImageAction = "approve" | "reject";

export type AdminListingPublicationState =
  | "awaiting_images"
  | "ai_review"
  | "admin_review"
  | "scheduled"
  | "published"
  | "changes_requested";

export type MarketplacePublicationSettings = {
  adminReviewEnabled: boolean;
  autoPublishDelaySeconds: number;
  updatedByProfileId: string | null;
  updatedAt: string;
};
export type AdminListingImageReviewStatus = "pending" | "approved" | "needs_review" | "rejected";

export type AdminListingImage = {
  id: string;
  url: string;
  sortOrder: number;
  reviewStatus: AdminListingImageReviewStatus;
  reviewedAt: string | null;
  reviewedByProfileId: string | null;
  authenticity: {
    decision: "allow" | "needs_review" | "reject" | null;
    confidence: number | null;
    providerName: string | null;
    modelName: string | null;
    promptVersion: string | null;
    reasons: string[];
    flags: Record<string, unknown>;
    checkedAt: string | null;
  };
  createdAt: string;
};

export type ViewerListingImage = Pick<
  AdminListingImage,
  "id" | "url" | "sortOrder" | "reviewStatus" | "createdAt"
>;

export type AdminListingSummary = {
  id: string;
  title: string;
  description: string | null;
  price: {
    amount: string;
    currency: string;
  } | null;
  currency: string;
  status: AdminListingStatus;
  publicationState: AdminListingPublicationState;
  publishAfter: string | null;
  publishedAt: string | null;
  publicationReviewReason: string | null;
  listingType: string;
  condition: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  seller: {
    profileId: string;
    displayName: string;
    locationCity: string | null;
    createdAt: string;
  };
  primaryImage: AdminListingImage | null;
  imageCount: number;
  moderation: {
    relatedCaseCount: number;
    openRelatedCaseCount: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type ViewerListingSummary = Pick<
  AdminListingSummary,
  | "id"
  | "title"
  | "description"
  | "price"
  | "currency"
  | "status"
  | "publicationState"
  | "publishAfter"
  | "publishedAt"
  | "listingType"
  | "condition"
  | "category"
  | "seller"
  | "imageCount"
  | "createdAt"
  | "updatedAt"
> & {
  primaryImage: ViewerListingImage | null;
};

export type AdminListingResponseSummary = AdminListingSummary | ViewerListingSummary;

export type AdminListingRelatedCase = {
  caseId: string;
  reportId: string | null;
  status: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  reportStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminListingAuditEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  actor: {
    id: string;
    displayName: string | null;
  } | null;
  metadata: Record<string, string | number | boolean | string[] | null>;
};

export type AdminListingDetail = AdminListingSummary & {
  images: AdminListingImage[];
  relatedModerationCases: AdminListingRelatedCase[];
  actionEligibility: {
    canArchive: boolean;
    canRestore: boolean;
    canPublish: boolean;
    canRequestChanges: boolean;
    supportedActions: AdminListingAction[];
  };
  auditTrail: AdminListingAuditEvent[];
};

export type ViewerListingDetail = ViewerListingSummary & {
  images: ViewerListingImage[];
};

export type ListAdminListingsParams = {
  status?: AdminListingStatus;
  imageReviewStatus?: AdminListingImageReviewStatus;
  publicationState?: AdminListingPublicationState;
  q?: string;
  categoryId?: string;
  sort?: AdminListingSort;
  limit?: number;
};

export type ListAdminListingsResponse = {
  listings: AdminListingResponseSummary[];
};

export type GetAdminListingResponse = {
  listing: AdminListingDetail | ViewerListingDetail;
};

export type ApplyAdminListingActionInput = {
  action: AdminListingAction;
  reason: string;
};

export type ApplyAdminListingActionResponse = {
  listing: AdminListingDetail;
  action: {
    listingId: string;
    action: AdminListingAction;
    previousStatus: string;
    nextStatus: string;
    previousPublicationState: AdminListingPublicationState;
    nextPublicationState: AdminListingPublicationState;
    auditEventId: string;
  };
};

export type ApplyAdminListingImageActionInput = {
  action: AdminListingImageAction;
  reason: string;
};

export type ApplyAdminListingImageActionResponse = {
  listing: AdminListingDetail;
  image: AdminListingImage;
  auditEventId: string;
};

const ADMIN_LISTINGS_BASE_PATH = "/api/v1/admin/listings";

export async function listAdminListings(
  params?: ListAdminListingsParams,
): Promise<ApiResponse<ListAdminListingsResponse>> {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.set("status", params.status);
  }
  if (params?.imageReviewStatus) {
    searchParams.set("imageReviewStatus", params.imageReviewStatus);
  }
  if (params?.publicationState) {
    searchParams.set("publicationState", params.publicationState);
  }
  if (params?.q) {
    searchParams.set("q", params.q);
  }
  if (params?.categoryId) {
    searchParams.set("categoryId", params.categoryId);
  }
  if (params?.sort) {
    searchParams.set("sort", params.sort);
  }
  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const query = searchParams.toString();
  const path = `${ADMIN_LISTINGS_BASE_PATH}${query ? `?${query}` : ""}`;

  return adminRequest<ListAdminListingsResponse>(path);
}

export async function getMarketplacePublicationSettings(): Promise<
  ApiResponse<{ settings: MarketplacePublicationSettings }>
> {
  return adminRequest<{ settings: MarketplacePublicationSettings }>(
    `${ADMIN_LISTINGS_BASE_PATH}/publication-settings`,
  );
}

export async function updateMarketplacePublicationSettings(input: {
  adminReviewEnabled: boolean;
  autoPublishDelaySeconds: number;
}): Promise<ApiResponse<{ settings: MarketplacePublicationSettings }>> {
  return adminRequest<{ settings: MarketplacePublicationSettings }>(
    `${ADMIN_LISTINGS_BASE_PATH}/publication-settings`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function getAdminListing(
  listingId: string,
): Promise<ApiResponse<GetAdminListingResponse>> {
  return adminRequest<GetAdminListingResponse>(
    `${ADMIN_LISTINGS_BASE_PATH}/${listingId}`,
  );
}

export async function applyAdminListingAction(
  listingId: string,
  input: ApplyAdminListingActionInput,
): Promise<ApiResponse<ApplyAdminListingActionResponse>> {
  const response = await adminRequest<ApplyAdminListingActionResponse["action"]>(
    `${ADMIN_LISTINGS_BASE_PATH}/${listingId}/actions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    return response;
  }

  const refreshedListing = await getAdminListing(listingId);

  if (!refreshedListing.ok) {
    return refreshedListing;
  }
  if (!isAdminListingDetail(refreshedListing.data.listing)) {
    return readOnlyMutationFailure();
  }

  return {
    ok: true,
    data: {
      listing: refreshedListing.data.listing,
      action: response.data,
    },
  };
}

export async function applyAdminListingImageAction(
  listingId: string,
  imageId: string,
  input: ApplyAdminListingImageActionInput,
): Promise<ApiResponse<ApplyAdminListingImageActionResponse>> {
  const response = await adminRequest<{
    image: AdminListingImage;
    auditEventId: string;
  }>(`${ADMIN_LISTINGS_BASE_PATH}/${listingId}/images/${imageId}/actions`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    return response;
  }

  const refreshedListing = await getAdminListing(listingId);

  if (!refreshedListing.ok) {
    return refreshedListing;
  }
  if (!isAdminListingDetail(refreshedListing.data.listing)) {
    return readOnlyMutationFailure();
  }

  return {
    ok: true,
    data: {
      listing: refreshedListing.data.listing,
      image: response.data.image,
      auditEventId: response.data.auditEventId,
    },
  };
}

function isAdminListingDetail(
  listing: AdminListingDetail | ViewerListingDetail,
): listing is AdminListingDetail {
  return "actionEligibility" in listing;
}

function readOnlyMutationFailure(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "Read-only backoffice sessions cannot mutate listings.",
    },
  };
}

async function adminRequest<TData>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<TData>> {
  try {
    const response = await authFetch(getApiBaseUrl(), path, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    return (await response.json()) as ApiResponse<TData>;
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
