"use client";

import type { ApiResponse, AnalyticsEventEnvelope } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";

export type AnalyticsBatchResponse = {
  accepted: number;
  duplicated: number;
  rejected: Array<{
    eventId?: string;
    reason: string;
  }>;
};

export async function sendWebAnalyticsBatch(
  events: AnalyticsEventEnvelope[]
): Promise<ApiResponse<AnalyticsBatchResponse>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/analytics/events/batch`, {
      body: JSON.stringify({ events }),
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    return (await response.json()) as ApiResponse<AnalyticsBatchResponse>;
  } catch {
    return {
      ok: false,
      error: {
        code: "ANALYTICS_UNAVAILABLE",
        message: "Analytics unavailable."
      }
    };
  }
}

export function sendWebAnalyticsBeacon(events: AnalyticsEventEnvelope[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }

  const payload = new Blob([JSON.stringify({ events })], {
    type: "application/json"
  });

  return navigator.sendBeacon(`${getApiBaseUrl()}/api/v1/analytics/events/batch`, payload);
}
