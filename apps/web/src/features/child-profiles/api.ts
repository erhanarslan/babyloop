"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authFetch } from "../../lib/auth-client";

export type ChildAgeBand =
  | "expecting"
  | "newborn_0_3"
  | "infant_3_6"
  | "infant_6_12"
  | "toddler_12_24"
  | "preschool_24_36"
  | "child_3_plus";

export type ChildProfile = {
  id: string;
  label: string;
  ageBand: ChildAgeBand;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LifecycleRecommendationGroup = {
  childProfileId: string;
  childProfileLabel: string;
  ageBand: ChildAgeBand;
  recommendations: Array<{
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    reasonCode: string;
    reasonLabel: string;
  }>;
};

export type ChildProfilesPayload = {
  childProfiles: ChildProfile[];
};

export type ChildProfilePayload = {
  childProfile: ChildProfile;
};

export type LifecycleRecommendationsPayload = {
  groups: LifecycleRecommendationGroup[];
};

export async function fetchChildProfiles(
  apiBaseUrl: string
): Promise<ApiResponse<ChildProfilesPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/child-profiles");

  return response.json() as Promise<ApiResponse<ChildProfilesPayload>>;
}

export async function createChildProfile(
  apiBaseUrl: string,
  payload: { label: string; ageBand: ChildAgeBand; isActive: boolean }
): Promise<ApiResponse<ChildProfilePayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/child-profiles", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<ApiResponse<ChildProfilePayload>>;
}

export async function updateChildProfile(
  apiBaseUrl: string,
  childProfileId: string,
  payload: Partial<{ label: string; ageBand: ChildAgeBand; isActive: boolean }>
): Promise<ApiResponse<ChildProfilePayload>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/child-profiles/${childProfileId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<ApiResponse<ChildProfilePayload>>;
}

export async function deleteChildProfile(
  apiBaseUrl: string,
  childProfileId: string
): Promise<ApiResponse<{ deleted: true }>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/child-profiles/${childProfileId}`, {
    method: "DELETE"
  });

  return response.json() as Promise<ApiResponse<{ deleted: true }>>;
}

export async function fetchLifecycleRecommendations(
  apiBaseUrl: string
): Promise<ApiResponse<LifecycleRecommendationsPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/child-profiles/lifecycle-recommendations");

  return response.json() as Promise<ApiResponse<LifecycleRecommendationsPayload>>;
}
