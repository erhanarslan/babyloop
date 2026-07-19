import {
  mobileAuthFetch,
  type MobileApiResponse
} from "../auth/auth-api";

export type MobileNotificationActorProfile = {
  id: string;
  displayName: string;
};

export type MobileNotificationType =
  | "message_received"
  | "listing_favorited"
  | "system"
  | string;

export type MobileNotification = {
  id: string;
  recipientProfileId: string;
  actorProfile: MobileNotificationActorProfile | null;
  type: MobileNotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type MobileChildLifecycleNotificationGeneration = {
  createdCount: number;
  skippedCount: number;
  notifications: MobileNotification[];
  deliveryChannel: "in_app";
  draftOnly: false;
  note: string;
};

export type MobileNotificationPreference = {
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
  providerCallAllowed: boolean;
  draftOnly: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MobileNotificationPreferenceAuditEvent = {
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

export type MobileNotificationPreferencesPayload = {
  preferences: MobileNotificationPreference[];
  recentAuditEvents: MobileNotificationPreferenceAuditEvent[];
  summary: {
    deliveryProvidersEnabled: boolean;
    providerCallsAllowed: boolean;
    emailProviderEnabled?: boolean;
    supportedSources: string[];
    supportedChannels: string[];
    defaultEnabledChannels: string[];
    draftOnlyChannels: string[];
    disabledChannels: string[];
  };
};

export type UpdateMobileNotificationPreferenceInput = {
  source: string;
  channel: string;
  enabled: boolean;
  mutedUntil?: string | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string;
  digest?: "immediate" | "daily" | "weekly";
  reason?: string | null;
};

export type MobilePushTokenRegistration = {
  id: string;
  platform: "ios" | "android" | "expo";
  tokenHashPrefix: string;
  redactedToken: string;
  deviceLabel: string | null;
  lastSeenAt: string;
  revokedAt: string | null;
  deliveryAllowed: false;
  providerCallAllowed: false;
};

export async function fetchMobileNotifications(): Promise<MobileApiResponse<{
  notifications: MobileNotification[];
}>> {
  return requestMobileNotificationsApi("/api/v1/notifications");
}

export async function fetchMobileUnreadNotificationCount(): Promise<MobileApiResponse<{
  count: number;
}>> {
  return requestMobileNotificationsApi("/api/v1/notifications/unread-count");
}

export async function markMobileNotificationRead(
  notificationId: string
): Promise<MobileApiResponse<{ notification: MobileNotification }>> {
  return requestMobileNotificationsApi(
    `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "PATCH"
    }
  );
}

export async function markAllMobileNotificationsRead(): Promise<MobileApiResponse<{
  updatedCount: number;
}>> {
  return requestMobileNotificationsApi("/api/v1/notifications/read-all", {
    method: "PATCH"
  });
}

export async function generateMobileChildLifecycleNotifications(): Promise<
  MobileApiResponse<MobileChildLifecycleNotificationGeneration>
> {
  return requestMobileNotificationsApi("/api/v1/notifications/child-lifecycle/generate", {
    method: "POST"
  });
}

export async function fetchMobileNotificationPreferences(): Promise<
  MobileApiResponse<MobileNotificationPreferencesPayload>
> {
  return requestMobileNotificationsApi("/api/v1/notification-preferences");
}

export async function updateMobileNotificationPreference(
  input: UpdateMobileNotificationPreferenceInput
): Promise<MobileApiResponse<{
  preference: MobileNotificationPreference;
  auditEvent: MobileNotificationPreferenceAuditEvent;
  summary: MobileNotificationPreferencesPayload["summary"];
}>> {
  return requestMobileNotificationsApi("/api/v1/notification-preferences", {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export async function fetchMobilePushTokenRegistrations(): Promise<
  MobileApiResponse<{ tokens: MobilePushTokenRegistration[] }>
> {
  return requestMobileNotificationsApi("/api/v1/notifications/push-tokens");
}

export async function registerMobilePushToken(input: {
  token: string;
  platform: MobilePushTokenRegistration["platform"];
  deviceLabel?: string;
}): Promise<MobileApiResponse<{ token: MobilePushTokenRegistration }>> {
  return requestMobileNotificationsApi("/api/v1/notifications/push-tokens", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export async function revokeMobilePushToken(token: string): Promise<MobileApiResponse<{ revoked: true }>> {
  return requestMobileNotificationsApi("/api/v1/notifications/push-tokens", {
    method: "DELETE",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ token })
  });
}

async function requestMobileNotificationsApi<T>(
  path: string,
  init: RequestInit = {}
): Promise<MobileApiResponse<T>> {
  try {
    const response = await mobileAuthFetch(path, init);

    return parseMobileNotificationsApiResponse<T>(response);
  } catch {
    return {
      ok: false,
      error: {
        code: "API_UNAVAILABLE",
        message: "BabyLoop bildirimleri şu an yüklenemedi."
      }
    };
  }
}

async function parseMobileNotificationsApiResponse<T>(
  response: Response
): Promise<MobileApiResponse<T>> {
  const payload: unknown = await response.json().catch(() => null);

  if (isMobileApiResponse<T>(payload)) {
    return payload;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: `HTTP_${response.status}`,
        message: `Request failed with status ${response.status}.`
      }
    };
  }

  return {
    ok: false,
    error: {
      code: "INVALID_API_RESPONSE",
      message: "BabyLoop API returned an invalid response."
    }
  };
}

function isMobileApiResponse<T>(value: unknown): value is MobileApiResponse<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok === true) {
    return "data" in value;
  }

  return isRecord(value.error) && typeof value.error.message === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
