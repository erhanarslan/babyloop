"use client";

import type { ApiResponse, RealtimeNotification } from "@babyloop/shared";
import { authFetch } from "../../lib/auth-client";

export type Notification = RealtimeNotification;

export type NotificationsPayload = {
  notifications: Notification[];
};

export type NotificationPayload = {
  notification: Notification;
};

export type UnreadCountPayload = {
  count: number;
};

export type ReadAllPayload = {
  updatedCount: number;
};

export async function fetchNotifications(
  apiBaseUrl: string
): Promise<ApiResponse<NotificationsPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/notifications");

  return response.json() as Promise<ApiResponse<NotificationsPayload>>;
}

const UNREAD_COUNT_DEDUPE_WINDOW_MS = 1500;

let unreadCountInFlight:
  | {
      apiBaseUrl: string;
      request: Promise<ApiResponse<UnreadCountPayload>>;
    }
  | null = null;

let unreadCountCache:
  | {
      apiBaseUrl: string;
      body: ApiResponse<UnreadCountPayload>;
      timestamp: number;
    }
  | null = null;

export async function fetchUnreadNotificationCount(
  apiBaseUrl: string,
  options: { force?: boolean } = {}
): Promise<ApiResponse<UnreadCountPayload>> {
  const now = Date.now();

  if (
    !options.force &&
    unreadCountCache &&
    unreadCountCache.apiBaseUrl === apiBaseUrl &&
    now - unreadCountCache.timestamp < UNREAD_COUNT_DEDUPE_WINDOW_MS
  ) {
    return unreadCountCache.body;
  }

  if (
    !options.force &&
    unreadCountInFlight &&
    unreadCountInFlight.apiBaseUrl === apiBaseUrl
  ) {
    return unreadCountInFlight.request;
  }

  const request = authFetch(apiBaseUrl, "/api/v1/notifications/unread-count")
    .then((response) => response.json() as Promise<ApiResponse<UnreadCountPayload>>)
    .then((body) => {
      unreadCountCache = {
        apiBaseUrl,
        body,
        timestamp: Date.now()
      };

      return body;
    });

  unreadCountInFlight = {
    apiBaseUrl,
    request
  };

  try {
    return await request;
  } finally {
    if (unreadCountInFlight?.request === request) {
      unreadCountInFlight = null;
    }
  }
}

export async function markNotificationRead(
  apiBaseUrl: string,
  notificationId: string
): Promise<ApiResponse<NotificationPayload>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/notifications/${notificationId}/read`, {
    method: "PATCH"
  });

  return response.json() as Promise<ApiResponse<NotificationPayload>>;
}

export async function markAllNotificationsRead(
  apiBaseUrl: string
): Promise<ApiResponse<ReadAllPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/notifications/read-all", {
    method: "PATCH"
  });

  return response.json() as Promise<ApiResponse<ReadAllPayload>>;
}
