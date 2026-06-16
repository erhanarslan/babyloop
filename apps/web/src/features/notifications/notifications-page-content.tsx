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
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageContainer,
  PageHeading
} from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { getAuthToken } from "../../lib/auth-client";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { getRealtimeSocket } from "../../lib/realtime-client";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { formatDateTime } from "../listings/listing-display";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification
} from "./api";
import { dispatchNotificationUnreadCountUpdated } from "./unread-count-events";

type NotificationsPageContentProps = {
  apiBaseUrl: string;
};

type NotificationFilter = "all" | "unread" | "messages" | "listings" | "seller";

const FILTERS: NotificationFilter[] = ["all", "unread", "messages", "listings", "seller"];

const activityWorkflowSteps = [
  {
    title: "Triage",
    body: "Open unread updates first, then separate messages from listing activity."
  },
  {
    title: "Act",
    body: "Jump to the linked conversation, listing, or seller workspace only when the update needs action."
  },
  {
    title: "Clear",
    body: "Mark items read after review so header counts, inbox state, and realtime feedback stay aligned."
  }
];

export function NotificationsPageContent({ apiBaseUrl }: NotificationsPageContentProps) {
  const { dictionary, locale } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const clearProtectedState = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setActiveFilter("all");
    setPendingNotificationId(null);
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

  const metrics = useMemo(() => buildNotificationMetrics(notifications), [notifications]);
  const filteredNotifications = useMemo(
    () =>
      sortNotifications(notifications.filter((notification) => matchesFilter(notification, activeFilter))),
    [activeFilter, notifications]
  );

  async function handleMarkRead(notificationId: string) {
    setActionMessage(null);
    setPendingNotificationId(notificationId);

    try {
      const body = await markNotificationRead(apiBaseUrl, notificationId);

      if (!body.ok) {
        setActionMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      const wasUnread = notifications.some(
        (notification) => notification.id === notificationId && !notification.readAt
      );
      const nextUnreadCount = wasUnread ? Math.max(unreadCount - 1, 0) : unreadCount;

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId ? body.data.notification : notification
        )
      );
      setUnreadCount(nextUnreadCount);
      dispatchNotificationUnreadCountUpdated(nextUnreadCount);
    } catch {
      setActionMessage(dictionary.common.apiUnavailable);
    } finally {
      setPendingNotificationId(null);
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
      dispatchNotificationUnreadCountUpdated(0);
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
      <PageContainer className="notification-center-layout notifications-layout">
        <NotificationCenterHero unreadCount={unreadCount} />

        <section className="notification-workflow-grid" aria-label="Notification workflow">
          {activityWorkflowSteps.map((step, index) => (
            <Card as="article" className="notification-workflow-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </Card>
          ))}
        </section>

        {isCheckingAuth || isLoading ? (
          <LoadingBlock title={dictionary.notifications.loading} message="Fetching marketplace updates safely." />
        ) : message ? (
          <EmptyState
            title={dictionary.notifications.unavailable}
            message={message}
            actionHref="/login"
            actionLabel={dictionary.common.login}
          />
        ) : (
          <section className="notifications-panel notification-inbox-panel" aria-label={dictionary.notifications.title}>
            <NotificationOverview metrics={metrics} unreadCount={unreadCount} />

            <div className="notification-filter-tabs" aria-label="Filter notifications">
              {FILTERS.map((filter) => (
                <button
                  aria-pressed={activeFilter === filter}
                  className={activeFilter === filter ? "active" : ""}
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                >
                  {getFilterLabel(filter)}
                  <span>{getFilterCount(metrics, filter)}</span>
                </button>
              ))}
            </div>

            <div className="notifications-toolbar notification-toolbar-polished">
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
            ) : filteredNotifications.length === 0 ? (
              <EmptyState
                title="No notifications in this filter"
                message="Switch filters or wait for new marketplace activity."
              />
            ) : (
              <ol className="notification-list notification-list-polished">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    isPending={pendingNotificationId === notification.id}
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

function NotificationCenterHero({ unreadCount }: { unreadCount: number }) {
  return (
    <Card as="section" className="notification-center-hero" aria-label="Notification center overview">
      <div>
        <p className="eyebrow">Activity inbox</p>
        <h2>Review marketplace updates without exposing unnecessary identity details.</h2>
        <p>
          Notifications connect messages, listing status changes, and privacy-safe seller activity.
          Favorite notifications stay actor-anonymous by design.
        </p>
        <div className="notification-hero-actions">
          <Link href="/conversations">Messages</Link>
          <Link href="/my-listings">My listings</Link>
          <Link href="/favorites">Saved listings</Link>
        </div>
      </div>

      <aside className="notification-hero-principles" aria-label="Notification center principles">
        <div>
          <span>Unread</span>
          <strong>{unreadCount}</strong>
        </div>
        <div>
          <span>Privacy</span>
          <strong>No favorite actor identity</strong>
        </div>
        <div>
          <span>Realtime</span>
          <strong>Header badge stays synced</strong>
        </div>
      </aside>
    </Card>
  );
}

function NotificationOverview({
  metrics,
  unreadCount
}: {
  metrics: ReturnType<typeof buildNotificationMetrics>;
  unreadCount: number;
}) {
  return (
    <Card as="section" className="notification-overview" aria-label="Notification summary">
      <div>
        <p className="eyebrow">Inbox summary</p>
        <h2>Prioritize updates that need action</h2>
        <p>
          Messages usually need the fastest review. Listing activity and status updates can be cleared after
          you check the related listing or seller workspace.
        </p>
      </div>

      <div className="notification-metrics">
        <MetricCard label="Total" value={metrics.total} />
        <MetricCard label="Unread" value={unreadCount} />
        <MetricCard label="Messages" value={metrics.messages} />
        <MetricCard label="Listings" value={metrics.listings} />
        <MetricCard label="Seller" value={metrics.seller} />
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="notification-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NotificationItem({
  isPending,
  locale,
  notification,
  onMarkRead
}: {
  isPending: boolean;
  locale: "en" | "tr";
  notification: Notification;
  onMarkRead: (notificationId: string) => Promise<void>;
}) {
  const { dictionary } = useI18n();
  const destination = getNotificationDestination(notification);
  const actionLabel = getNotificationActionLabel(notification, dictionary);
  const displayText = getNotificationDisplayText(notification, dictionary);
  const isUnread = !notification.readAt;
  const notificationKind = getNotificationKind(notification);

  return (
    <li className={isUnread ? "notification-item notification-item-unread notification-item-polished" : "notification-item notification-item-polished"}>
      <div className="notification-item-main">
        <div className="notification-item-heading">
          <div>
            <p className="listing-meta">{dictionary.notifications.typeLabels[notification.type]}</p>
            <h2>{displayText.title}</h2>
          </div>
          <Badge tone={isUnread ? "warning" : "neutral"}>
            {isUnread ? "Unread" : dictionary.notifications.read}
          </Badge>
        </div>

        <p className="notification-body">{displayText.body}</p>

        <div className="notification-context-strip">
          <span>{notificationKind}</span>
          <time>{formatDateTime(notification.createdAt, locale)}</time>
        </div>
      </div>

      <div className="notification-actions notification-actions-polished">
        {destination ? (
          <Link href={destination}>{actionLabel}</Link>
        ) : null}
        {isUnread ? (
          <button disabled={isPending} type="button" onClick={() => void onMarkRead(notification.id)}>
            {isPending ? "Marking..." : dictionary.notifications.markAsRead}
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

  if (notification.type === "message_received") {
    return {
      title: dictionary.notifications.messageReceived,
      body: notification.body
    };
  }

  if (notification.type === "listing_status_changed") {
    return {
      title: dictionary.notifications.listingStatusChanged,
      body: notification.body
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

  if (notification.type === "listing_favorited") {
    return "Review seller workspace";
  }

  if (notification.type === "listing_status_changed") {
    return dictionary.notifications.viewListing;
  }

  return dictionary.common.viewDetails;
}

function buildNotificationMetrics(notifications: Notification[]) {
  return notifications.reduce(
    (metrics, notification) => {
      metrics.total += 1;

      if (!notification.readAt) {
        metrics.unread += 1;
      }

      if (notification.type === "message_received") {
        metrics.messages += 1;
      }

      if (notification.type === "listing_status_changed") {
        metrics.listings += 1;
      }

      if (notification.type === "listing_favorited") {
        metrics.seller += 1;
      }

      return metrics;
    },
    {
      total: 0,
      unread: 0,
      messages: 0,
      listings: 0,
      seller: 0
    }
  );
}

function matchesFilter(notification: Notification, filter: NotificationFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "unread") {
    return !notification.readAt;
  }

  if (filter === "messages") {
    return notification.type === "message_received";
  }

  if (filter === "listings") {
    return notification.type === "listing_status_changed";
  }

  return notification.type === "listing_favorited";
}

function getFilterLabel(filter: NotificationFilter): string {
  const labels = {
    all: "All",
    unread: "Unread",
    messages: "Messages",
    listings: "Listings",
    seller: "Seller activity"
  };

  return labels[filter];
}

function getFilterCount(
  metrics: ReturnType<typeof buildNotificationMetrics>,
  filter: NotificationFilter
): number {
  if (filter === "all") {
    return metrics.total;
  }

  if (filter === "unread") {
    return metrics.unread;
  }

  if (filter === "messages") {
    return metrics.messages;
  }

  if (filter === "listings") {
    return metrics.listings;
  }

  return metrics.seller;
}

function getNotificationKind(notification: Notification): string {
  if (notification.type === "message_received") {
    return "Conversation update";
  }

  if (notification.type === "listing_favorited") {
    return "Privacy-safe seller signal";
  }

  if (notification.type === "listing_status_changed") {
    return "Listing lifecycle update";
  }

  return "Marketplace update";
}

function sortNotifications(notifications: Notification[]): Notification[] {
  return [...notifications].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
