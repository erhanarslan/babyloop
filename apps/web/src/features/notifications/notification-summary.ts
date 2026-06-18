import type { Notification } from "./api";

export type FavoriteNotificationAggregate = {
  href: string | null;
  listingId: string | null;
  title: string;
  todayCount: number;
  totalCount: number;
};

export type NotificationSummary = {
  favoriteAggregates: FavoriteNotificationAggregate[];
  unreadMessageCount: number;
  unreadCount: number;
};

export function buildNotificationSummary(notifications: Notification[]): NotificationSummary {
  const favoriteMap = new Map<string, FavoriteNotificationAggregate>();
  const todayKey = toDateKey(new Date());
  let unreadMessageCount = 0;
  let unreadCount = 0;

  for (const notification of notifications) {
    if (!notification.readAt) {
      unreadCount += 1;
    }

    if (notification.type === "message_received" && !notification.readAt) {
      unreadMessageCount += 1;
    }

    if (notification.type !== "listing_favorited") {
      continue;
    }

    const listingId = notification.entityType === "listing" ? notification.entityId : null;
    const key = listingId ?? `notification:${notification.id}`;
    const existing = favoriteMap.get(key);
    const createdToday = toDateKey(new Date(notification.createdAt)) === todayKey;

    if (existing) {
      existing.totalCount += 1;
      existing.todayCount += createdToday ? 1 : 0;
      continue;
    }

    favoriteMap.set(key, {
      href: listingId ? `/listings/${listingId}` : null,
      listingId,
      title: getFavoriteListingTitle(notification),
      todayCount: createdToday ? 1 : 0,
      totalCount: 1
    });
  }

  return {
    favoriteAggregates: [...favoriteMap.values()].sort((left, right) => {
      if (right.todayCount !== left.todayCount) {
        return right.todayCount - left.todayCount;
      }

      return right.totalCount - left.totalCount;
    }),
    unreadMessageCount,
    unreadCount
  };
}

export function sortNotifications(notifications: Notification[]): Notification[] {
  return [...notifications].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getNotificationDestination(notification: Notification): string | null {
  if (notification.type === "message_received" && notification.entityType === "conversation") {
    return notification.entityId ? `/conversations/${notification.entityId}` : "/conversations";
  }

  if (notification.type === "listing_favorited") {
    return notification.entityType === "listing" && notification.entityId
      ? `/listings/${notification.entityId}`
      : "/my-listings";
  }

  if (notification.type === "listing_status_changed") {
    return notification.entityType === "listing" && notification.entityId
      ? `/listings/${notification.entityId}`
      : "/my-listings";
  }

  return null;
}

export function getNotificationTitle(notification: Notification): string {
  if (notification.type === "message_received") {
    return "Yeni mesaj";
  }

  if (notification.type === "listing_favorited") {
    return "Favori hareketi";
  }

  if (notification.type === "listing_status_changed") {
    return "İlan durumu güncellendi";
  }

  return safeDisplayText(notification.title, "Bildirim");
}

export function getNotificationBody(notification: Notification): string {
  if (notification.type === "listing_favorited") {
    return "Bir kullanıcı ürününü favori ürünlere ekledi.";
  }

  if (notification.type === "message_received") {
    return "Yeni bir mesajın var.";
  }

  if (notification.type === "listing_status_changed") {
    return "İlan durumunda bir değişiklik var.";
  }

  return "Yeni bir bildirim var.";
}

function getFavoriteListingTitle(notification: Notification): string {
  const metadataTitle = notification.metadata.listingTitle;

  if (typeof metadataTitle === "string" && metadataTitle.trim().length > 0) {
    return safeDisplayText(metadataTitle, "İlan");
  }

  if (notification.entityId) {
    return `İlan ${notification.entityId.slice(0, 8)}`;
  }

  return "İlan";
}

function safeDisplayText(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 0 ? normalized.slice(0, 160) : fallback;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
