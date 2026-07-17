import type { ApiResponse, AnalyticsEventEnvelope } from "@babyloop/shared";

import { getApiBaseUrl } from "../../config/api";

export type MobileAnalyticsBatchResponse = {
  accepted: number;
  duplicated: number;
  rejected: Array<{
    eventId?: string;
    reason: string;
  }>;
};

export async function sendMobileAnalyticsBatch(
  events: AnalyticsEventEnvelope[]
): Promise<ApiResponse<MobileAnalyticsBatchResponse>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/analytics/events/batch`, {
      body: JSON.stringify({ events }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    return (await response.json()) as ApiResponse<MobileAnalyticsBatchResponse>;
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
