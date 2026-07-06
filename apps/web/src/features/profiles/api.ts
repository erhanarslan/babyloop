"use client";

import type { ApiResponse } from "@babyloop/shared";

export type PublicSellerProfileSummary = {
  profileId: string;
  displayName: string;
  locationCity: string | null;
  safetyStatus: "active" | "restricted" | "suspended";
  activeListingCount: number;
  soldListingCount: number;
  memberSince: string;
};

export async function fetchPublicSellerProfile(
  apiBaseUrl: string,
  profileId: string
): Promise<ApiResponse<{ profile: PublicSellerProfileSummary }>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/profiles/${encodeURIComponent(profileId)}`, {
    cache: "no-store",
    credentials: "include"
  });

  return response.json() as Promise<ApiResponse<{ profile: PublicSellerProfileSummary }>>;
}
