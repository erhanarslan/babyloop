import type { MobileNotification } from "./notifications-api";

export type MobileNotificationCard = {
  id: string;
  title: string;
  body: string;
  meta: string;
  unread: boolean;
  actionLabel: string | null;
  entityType: string | null;
  entityId: string | null;
  source: string | null;
};

export function getMobileNotificationCards(
  notifications: MobileNotification[]
): MobileNotificationCard[] {
  return notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    meta: formatNotificationMeta(notification),
    unread: notification.readAt === null,
    actionLabel: getNotificationActionLabel(notification),
    entityType: notification.entityType,
    entityId: notification.entityId,
    source: getNotificationSource(notification)
  }));
}

export function getMobileUnreadNotificationCountLabel(count: number): string {
  if (count <= 0) {
    return "Okunmamış bildirim yok";
  }

  return `${count} okunmamış bildirim`;
}

export function getNotificationActionLabel(notification: Pick<MobileNotification, "entityType">): string | null {
  if (notification.entityType === "conversation") {
    return "Konuşmayı aç";
  }

  if (notification.entityType === "listing") {
    return "İlanı aç";
  }

  if (notification.entityType === "child_profile") {
    return "Çocuğum sayfasına git";
  }

  return null;
}

export function formatNotificationDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(date);
}

function formatNotificationMeta(notification: MobileNotification): string {
  const pieces = [
    getNotificationTypeLabel(notification),
    formatNotificationDate(notification.createdAt)
  ].filter(Boolean);

  return pieces.join(" · ");
}

function getNotificationTypeLabel(notification: MobileNotification): string {
  if (notification.type === "message_received") {
    return "Mesaj";
  }

  if (notification.type === "listing_favorited") {
    return "Favori";
  }

  if (notification.metadata.source === "child_lifecycle") {
    return "Çocuk önerisi";
  }

  return "Sistem";
}

function getNotificationSource(notification: MobileNotification): string | null {
  return typeof notification.metadata.source === "string"
    ? notification.metadata.source
    : null;
}
