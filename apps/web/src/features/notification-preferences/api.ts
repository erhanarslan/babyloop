import type { ApiResponse } from "@babyloop/shared";
import { authFetch } from "../../lib/auth-client";


export type NotificationDeliveryDraft = {
  id: string;
  kind: "child_lifecycle" | "saved_search";
  title: string;
  body: string;
  channel: "in_app" | "email_draft";
  status: "draft_only";
  source: {
    type: "child_profile" | "saved_search";
    id: string;
    label: string;
  };
  action: {
    label: string;
    href: string;
  };
  reason: string;
  policy: {
    deliveryAllowed: false;
    draftOnly: true;
    dedupKey: string;
    frequencyWindowHours: number;
    blockedReasons: string[];
  };
};

export type NotificationDeliveryDraftsPayload = {
  drafts: NotificationDeliveryDraft[];
  summary: {
    total: number;
    childLifecycle: number;
    savedSearch: number;
    draftOnly: true;
  };
  note: string;
};

export async function fetchNotificationDeliveryDrafts(
  apiBaseUrl: string
): Promise<ApiResponse<NotificationDeliveryDraftsPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/notifications/delivery-drafts");

  return response.json() as Promise<ApiResponse<NotificationDeliveryDraftsPayload>>;
}
