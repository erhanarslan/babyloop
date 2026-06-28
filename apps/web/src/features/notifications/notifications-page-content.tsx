"use client";

import {
  REALTIME_EVENTS,
  type NotificationCreatedPayload,
  type NotificationReadAllPayload,
  type NotificationReadPayload,
  type NotificationUnreadCountUpdatedPayload
} from "@babyloop/shared";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  EmptyState,
  LoadingBlock,
  PageContainer
} from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { getAuthToken } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { getRealtimeSocket } from "../../lib/realtime-client";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { formatDateTime } from "../listings/listing-display";
import {
  fetchNotifications,
  markAllNotificationsRead,
  type Notification
} from "./api";
import {
  buildNotificationSummary,
  getNotificationBody,
  getNotificationDestination,
  getNotificationTitle,
  sortNotifications
} from "./notification-summary";
import styles from "./notifications-page-content.module.css";
import { dispatchNotificationUnreadCountUpdated } from "./unread-count-events";

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

      const nextNotifications = sortNotifications(body.data.notifications);
      const nextUnreadCount = nextNotifications.filter((notification) => !notification.readAt).length;

      setNotifications(nextNotifications);
      setUnreadCount(nextUnreadCount);
      dispatchNotificationUnreadCountUpdated(nextUnreadCount);
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
      setNotifications((currentNotifications) =>
        sortNotifications([
          payload.notification,
          ...currentNotifications.filter((notification) => notification.id !== payload.notification.id)
        ])
      );
      setUnreadCount(payload.unreadCount);
      dispatchNotificationUnreadCountUpdated(payload.unreadCount);
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
      dispatchNotificationUnreadCountUpdated(payload.unreadCount);
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
      dispatchNotificationUnreadCountUpdated(payload.unreadCount);
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

  const summary = useMemo(() => buildNotificationSummary(notifications), [notifications]);
  const recentNotifications = useMemo(() => notifications.slice(0, 20), [notifications]);
  const favoriteTotal = summary.favoriteAggregates.reduce(
    (total, item) => total + item.totalCount,
    0
  );

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
      dispatchNotificationUnreadCountUpdated(0);
    } catch {
      setActionMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsMarkingAll(false);
    }
  }

  return (
    <PageContainer className={styles.archive ?? ""}>
      <section className={styles.archiveHeader}>
        <div>
          <h1>{dictionary.notificationsArchive.pageTitle}</h1>
          <p>{dictionary.notificationsArchive.pageDescription}</p>
        </div>
        <Button
          disabled={isMarkingAll || unreadCount === 0}
          onClick={() => void handleMarkAllRead()}
          variant="secondary"
        >
          {isMarkingAll ? dictionary.notifications.markingAllRead : dictionary.notifications.markAllRead}
        </Button>
      </section>

      {isCheckingAuth || isLoading ? (
        <LoadingBlock title={dictionary.notificationsArchive.loadingTitle} message={dictionary.notificationsArchive.loadingMessage} />
      ) : message ? (
        <EmptyState
          title={dictionary.notificationsArchive.unavailableTitle}
          message={message}
          actionHref="/login"
          actionLabel={dictionary.common.login}
        />
      ) : (
        <section className={styles.archiveCard} aria-label="Bildirim özeti">
          {actionMessage ? (
            <Alert title={dictionary.notificationsArchive.actionFailedTitle} message={actionMessage} />
          ) : null}

          <div className={styles.summaryGrid}>
            <div>
              <span>{dictionary.notificationsArchive.unreadMessage}</span>
              <strong>{summary.unreadMessageCount}</strong>
              <Link href="/conversations">{dictionary.notificationsArchive.goToMessages}</Link>
            </div>
            <div>
              <span>{dictionary.notificationsArchive.favoriteActivity}</span>
              <strong>{favoriteTotal}</strong>
              <p>{dictionary.notificationsArchive.favoriteSummary.replace("{count}", String(favoriteTotal))}</p>
            </div>
          </div>

          <section className={styles.favoriteGroup} aria-label={dictionary.notificationsArchive.favoriteMovementsLabel}>
            <h2>{dictionary.notificationsArchive.favoritesTitle}</h2>
            {summary.favoriteAggregates.length > 0 ? (
              <ol>
                {summary.favoriteAggregates.map((item) => (
                  <li key={item.listingId ?? item.title}>
                    <div>
                      {item.href ? <Link href={item.href}>{item.title}</Link> : <span>{item.title}</span>}
                      <small>
                        {dictionary.notificationsArchive.favoriteStat
                          .replace("{total}", String(item.totalCount))
                          .replace("{today}", String(item.todayCount))}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>{dictionary.notificationsArchive.noFavoriteActivity}</p>
            )}
          </section>

          <section className={styles.recentList} aria-label={dictionary.notificationsArchive.recentLabel}>
            <h2>{dictionary.notificationsArchive.recentTitle}</h2>
            {recentNotifications.length > 0 ? (
              <ol>
                {recentNotifications.map((notification) => (
                  <NotificationArchiveItem
                    key={notification.id}
                    locale={locale}
                    notification={notification}
                    readLabel={dictionary.notifications.read}
                    unreadLabel={dictionary.notificationsArchive.unread}
                    openLabel={dictionary.notificationsArchive.open}
                  />
                ))}
              </ol>
            ) : (
              <EmptyState
                title={dictionary.notificationsArchive.noNotificationsTitle}
                message={dictionary.notificationsArchive.noNotificationsBody}
              />
            )}
          </section>
        </section>
      )}
    </PageContainer>
  );
}

function NotificationArchiveItem({
  locale,
  notification,
  openLabel,
  readLabel,
  unreadLabel
}: {
  locale: "en" | "tr";
  notification: Notification;
  openLabel: string;
  readLabel: string;
  unreadLabel: string;
}) {
  const destination = getNotificationDestination(notification);
  const isUnread = !notification.readAt;

  return (
    <li className={isUnread ? `${styles.archiveItem} ${styles.unread}` : styles.archiveItem}>
      <div>
        <strong>{getNotificationTitle(notification)}</strong>
        <p>{getNotificationBody(notification)}</p>
        <time>{formatDateTime(notification.createdAt, locale)}</time>
      </div>
      <div className={styles.archiveItemActions}>
        <span>{isUnread ? unreadLabel : readLabel}</span>
        {destination ? <Link href={destination}>{openLabel}</Link> : null}
      </div>
    </li>
  );
}
