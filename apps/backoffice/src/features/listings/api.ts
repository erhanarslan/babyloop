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

export type AdminListingAction = "archive" | "restore";
export type AdminListingImageAction = "approve" | "reject";

export type AdminListingImage = {
  id: string;
  url: string;
  sortOrder: number;
  reviewStatus: "approved" | "rejected";
  reviewedAt: string | null;
  reviewedByProfileId: string | null;
  createdAt: string;
};

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
    supportedActions: AdminListingAction[];
  };
  auditTrail: AdminListingAuditEvent[];
};

export type ListAdminListingsParams = {
  status?: AdminListingStatus;
  q?: string;
  categoryId?: string;
  sort?: AdminListingSort;
  limit?: number;
};

export type ListAdminListingsResponse = {
  listings: AdminListingSummary[];
};

export type GetAdminListingResponse = {
  listing: AdminListingDetail;
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

  return {
    ok: true,
    data: {
      listing: refreshedListing.data.listing,
      image: response.data.image,
      auditEventId: response.data.auditEventId,
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
