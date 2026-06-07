export const NOTIFICATION_UNREAD_COUNT_UPDATED_EVENT =
  "babyloop-notification-unread-count-updated";

export function dispatchNotificationUnreadCountUpdated(unreadCount: number): void {
  window.dispatchEvent(
    new CustomEvent<{ unreadCount: number }>(NOTIFICATION_UNREAD_COUNT_UPDATED_EVENT, {
      detail: { unreadCount }
    })
  );
}
