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

export async function fetchUnreadNotificationCount(
  apiBaseUrl: string
): Promise<ApiResponse<UnreadCountPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/notifications/unread-count");

  return response.json() as Promise<ApiResponse<UnreadCountPayload>>;
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
