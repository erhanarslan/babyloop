import type { MobileConversationSummary } from "./messages-api";

export function getMobileUnreadConversationCount(
  conversations: Array<Pick<MobileConversationSummary, "unreadCount">>
): number {
  return conversations.reduce((total, conversation) => {
    const count = Number.isFinite(conversation.unreadCount)
      ? Math.max(0, conversation.unreadCount)
      : 0;

    return total + count;
  }, 0);
}

export function getMobileMessagesTabBadgeLabel(
  conversations: Array<Pick<MobileConversationSummary, "unreadCount">>
): string | undefined {
  const unreadCount = getMobileUnreadConversationCount(conversations);

  if (unreadCount <= 0) {
    return undefined;
  }

  return unreadCount > 99 ? "99+" : unreadCount.toString();
}
