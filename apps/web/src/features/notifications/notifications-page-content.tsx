"use client";

import {
  REALTIME_EVENTS,
  type NotificationCreatedPayload,
  type NotificationReadAllPayload,
  type NotificationReadPayload,
  type NotificationUnreadCountUpdatedPayload
} from "@babyloop/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, EmptyState, LoadingBlock, PageContainer, PageHeading } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { getAuthToken } from "../../lib/auth-client";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { getRealtimeSocket } from "../../lib/realtime-client";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { formatDateTime } from "../listings/listing-display";
import { AccountSurfaceGuide } from "../account/account-surface-guide";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification
} from "./api";

type NotificationsPageContentProps = {
  apiBaseUrl: string;
};

export function NotificationsPageContent({ apiBaseUrl }: NotificationsPageContentProps) {
  const { dictionary, locale } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const clearProtectedState = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setMessage(null);
    setActionMessage(null);
    setIsLoading(false);
  }, []);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  const loadNotifications = useCallback(async () => {
    if (!(await requireAuth())) {
      return;
    }

    try {
      const body = await fetchNotifications(apiBaseUrl);

      if (!body.ok) {
        setMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setNotifications(body.data.notifications);
      setUnreadCount(body.data.notifications.filter((notification) => !notification.readAt).length);
      setMessage(null);
    } catch {
      setMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, dictionary, requireAuth]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (isCheckingAuth || isLoading || message) {
      return;
    }

    const socket = getRealtimeSocket(apiBaseUrl, getAuthToken());

    if (!socket) {
      return;
    }

    const realtimeSocket = socket;

    function handleNotificationCreated(payload: NotificationCreatedPayload) {
      setNotifications((currentNotifications) => [
        payload.notification,
        ...currentNotifications.filter((notification) => notification.id !== payload.notification.id)
      ]);
      setUnreadCount(payload.unreadCount);
    }

    function handleNotificationRead(payload: NotificationReadPayload) {
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === payload.notificationId
            ? { ...notification, readAt: payload.readAt }
            : notification
        )
      );
      setUnreadCount(payload.unreadCount);
    }

    function handleNotificationReadAll(payload: NotificationReadAllPayload) {
      const readAt = new Date().toISOString();
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt
        }))
      );
      setUnreadCount(payload.unreadCount);
    }

    function handleUnreadCountUpdated(payload: NotificationUnreadCountUpdatedPayload) {
      setUnreadCount(payload.unreadCount);
    }

    realtimeSocket.on(REALTIME_EVENTS.notificationCreated, handleNotificationCreated);
    realtimeSocket.on(REALTIME_EVENTS.notificationRead, handleNotificationRead);
    realtimeSocket.on(REALTIME_EVENTS.notificationReadAll, handleNotificationReadAll);
    realtimeSocket.on(REALTIME_EVENTS.notificationUnreadCountUpdated, handleUnreadCountUpdated);
    realtimeSocket.io.on("reconnect", loadNotifications);

    return () => {
      realtimeSocket.off(REALTIME_EVENTS.notificationCreated, handleNotificationCreated);
      realtimeSocket.off(REALTIME_EVENTS.notificationRead, handleNotificationRead);
      realtimeSocket.off(REALTIME_EVENTS.notificationReadAll, handleNotificationReadAll);
      realtimeSocket.off(REALTIME_EVENTS.notificationUnreadCountUpdated, handleUnreadCountUpdated);
      realtimeSocket.io.off("reconnect", loadNotifications);
    };
  }, [apiBaseUrl, isCheckingAuth, isLoading, loadNotifications, message]);

  async function handleMarkRead(notificationId: string) {
    setActionMessage(null);

    try {
      const body = await markNotificationRead(apiBaseUrl, notificationId);

      if (!body.ok) {
        setActionMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId ? body.data.notification : notification
        )
      );

      const unreadBody = await fetchUnreadNotificationCount(apiBaseUrl);

      if (unreadBody.ok) {
        setUnreadCount(unreadBody.data.count);
      }
    } catch {
      setActionMessage(dictionary.common.apiUnavailable);
    }
  }

  async function handleMarkAllRead() {
    setActionMessage(null);
    setIsMarkingAll(true);

    try {
      const body = await markAllNotificationsRead(apiBaseUrl);

      if (!body.ok) {
        setActionMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      const readAt = new Date().toISOString();
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt
        }))
      );
      setUnreadCount(0);
    } catch {
      setActionMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsMarkingAll(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow={dictionary.notifications.eyebrow}
        title={dictionary.notifications.title}
        description={dictionary.notifications.description}
      />
      <PageContainer className="notifications-layout">
        <AccountSurfaceGuide kind="notifications" />

        {isCheckingAuth || isLoading ? (
          <LoadingBlock title={dictionary.notifications.loading} />
        ) : message ? (
          <EmptyState
            title={dictionary.notifications.unavailable}
            message={message}
            actionHref="/login"
            actionLabel={dictionary.common.login}
          />
        ) : (
          <section className="notifications-panel" aria-label={dictionary.notifications.title}>
            <div className="notifications-toolbar">
              <p>
                {dictionary.notifications.unreadCount.replace("{count}", String(unreadCount))}
              </p>
              <Button
                disabled={isMarkingAll || unreadCount === 0}
                onClick={() => void handleMarkAllRead()}
                variant="secondary"
              >
                {isMarkingAll ? dictionary.notifications.markingAllRead : dictionary.notifications.markAllRead}
              </Button>
            </div>

            {actionMessage ? (
              <Alert
                title={dictionary.notifications.actionFailed}
                message={actionMessage}
              />
            ) : null}

            {notifications.length === 0 ? (
              <EmptyState
                title={dictionary.notifications.emptyTitle}
                message={dictionary.notifications.emptyBody}
              />
            ) : (
              <ol className="notification-list">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    locale={locale}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </ol>
            )}
          </section>
        )}
      </PageContainer>
    </>
  );
}

function NotificationItem({
  locale,
  notification,
  onMarkRead
}: {
  locale: "en" | "tr";
  notification: Notification;
  onMarkRead: (notificationId: string) => Promise<void>;
}) {
  const { dictionary } = useI18n();
  const destination = getNotificationDestination(notification);
  const actionLabel = getNotificationActionLabel(notification, dictionary);
  const displayText = getNotificationDisplayText(notification, dictionary);
  const isUnread = !notification.readAt;

  return (
    <li className={isUnread ? "notification-item notification-item-unread" : "notification-item"}>
      <div>
        <p className="listing-meta">{dictionary.notifications.typeLabels[notification.type]}</p>
        <h2>{displayText.title}</h2>
        <p className="notification-body">{displayText.body}</p>
        <time>{formatDateTime(notification.createdAt, locale)}</time>
      </div>
      <div className="notification-actions">
        {destination ? (
          <Link href={destination}>{actionLabel}</Link>
        ) : null}
        {isUnread ? (
          <button type="button" onClick={() => void onMarkRead(notification.id)}>
            {dictionary.notifications.markAsRead}
          </button>
        ) : (
          <span>{dictionary.notifications.read}</span>
        )}
      </div>
    </li>
  );
}

function getNotificationDisplayText(
  notification: Notification,
  dictionary: Dictionary
): { title: string; body: string } {
  if (notification.type === "listing_favorited") {
    return {
      title: dictionary.notifications.listingFavorited,
      body: dictionary.notifications.listingFavoritedBody
    };
  }

  return {
    title: notification.title,
    body: notification.body
  };
}

function getNotificationDestination(notification: Notification): string | null {
  if (notification.type === "message_received" && notification.entityType === "conversation") {
    return notification.entityId ? `/conversations/${notification.entityId}` : null;
  }

  if (notification.type === "listing_favorited") {
    return "/my-listings";
  }

  if (notification.type === "listing_status_changed") {
    return notification.entityId ? `/listings/${notification.entityId}` : "/my-listings";
  }

  return null;
}

function getNotificationActionLabel(
  notification: Notification,
  dictionary: Dictionary
): string {
  if (notification.type === "message_received") {
    return dictionary.notifications.viewConversation;
  }

  if (
    notification.type === "listing_favorited" ||
    notification.type === "listing_status_changed"
  ) {
    return dictionary.notifications.viewListing;
  }

  return dictionary.common.viewDetails;
}
