"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authFetch } from "../../lib/auth-client";

export type SellerDashboardSummary = {
  totals: {
    totalListings: number;
    activeListings: number;
    reservedListings: number;
    soldListings: number;
    archivedListings: number;
    totalFavorites: number;
    listingDetailViews: number;
    listingClicks: number;
    contactSellerIntents: number;
  };
  listings: Array<{
    listingId: string;
    title: string;
    status: string;
    categoryName: string;
    categorySlug: string;
    createdAt: string;
    favoriteCount: number;
    detailViews: number;
    listingClicks: number;
    contactSellerIntents: number;
  }>;
};

export async function fetchSellerDashboard(
  apiBaseUrl: string
): Promise<ApiResponse<{ summary: SellerDashboardSummary }>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/seller/dashboard");

  return response.json() as Promise<ApiResponse<{ summary: SellerDashboardSummary }>>;
}
