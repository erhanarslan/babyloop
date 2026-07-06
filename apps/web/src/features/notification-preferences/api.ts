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

export type NotificationPreference = {
  id: string | null;
  source: string;
  channel: string;
  enabled: boolean;
  mutedUntil: string | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  digest: "immediate" | "daily" | "weekly";
  deliveryAllowed: boolean;
  providerCallAllowed: false;
  draftOnly: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type NotificationPreferenceAuditEvent = {
  id: string;
  source: string;
  channel: string;
  oldEnabled: boolean | null;
  newEnabled: boolean;
  oldMutedUntil: string | null;
  newMutedUntil: string | null;
  oldDigest: string | null;
  newDigest: string | null;
  oldQuietHoursStart: string | null;
  newQuietHoursStart: string | null;
  oldQuietHoursEnd: string | null;
  newQuietHoursEnd: string | null;
  reason: string | null;
  createdAt: string;
};

export type NotificationPreferencesPayload = {
  preferences: NotificationPreference[];
  recentAuditEvents: NotificationPreferenceAuditEvent[];
  summary: {
    deliveryProvidersEnabled: false;
    providerCallsAllowed: false;
    supportedSources: string[];
    supportedChannels: string[];
    defaultEnabledChannels: string[];
    draftOnlyChannels: string[];
    disabledChannels: string[];
  };
};

export async function fetchNotificationDeliveryDrafts(
  apiBaseUrl: string
): Promise<ApiResponse<NotificationDeliveryDraftsPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/notifications/delivery-drafts");

  return response.json() as Promise<ApiResponse<NotificationDeliveryDraftsPayload>>;
}

export async function fetchNotificationPreferences(
  apiBaseUrl: string
): Promise<ApiResponse<NotificationPreferencesPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/notification-preferences");

  return response.json() as Promise<ApiResponse<NotificationPreferencesPayload>>;
}
