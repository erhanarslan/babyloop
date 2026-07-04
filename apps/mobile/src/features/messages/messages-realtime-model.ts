import type {
  MobileConversationDetail,
  MobileConversationMessage,
  MobileConversationSummary
} from "./messages-api";
import type {
  MobileMessageCreatedPayload,
  MobileRealtimeConversationSummary
} from "../realtime/mobile-realtime";

export function mergeRealtimeConversationSummary(
  currentConversations: MobileConversationSummary[],
  realtimeConversation: MobileRealtimeConversationSummary
): MobileConversationSummary[] {
  const nextConversation = toMobileConversationSummary(realtimeConversation);
  const merged = [
    nextConversation,
    ...currentConversations.filter((conversation) => conversation.id !== nextConversation.id)
  ];

  return sortConversationsByUpdatedAtDesc(merged);
}

export function mergeRealtimeConversationDetail(
  currentConversation: MobileConversationDetail | null,
  realtimeConversation: MobileRealtimeConversationSummary
): MobileConversationDetail | null {
  if (!currentConversation || currentConversation.id !== realtimeConversation.id) {
    return currentConversation;
  }

  const nextSummary = toMobileConversationSummary(realtimeConversation);

  return {
    ...currentConversation,
    ...nextSummary,
    listingId: currentConversation.listingId ?? realtimeConversation.contextListing?.id ?? null,
    listingTitle:
      realtimeConversation.contextListing?.title?.trim() ||
      currentConversation.listingTitle,
    otherProfileDisplayName:
      realtimeConversation.otherProfile.displayName?.trim() ||
      currentConversation.otherProfileDisplayName
  };
}

export function appendRealtimeMessage(
  currentMessages: MobileConversationMessage[],
  payload: MobileMessageCreatedPayload,
  conversationId: string
): MobileConversationMessage[] {
  if (payload.conversationId !== conversationId) {
    return currentMessages;
  }

  if (currentMessages.some((message) => message.id === payload.message.id)) {
    return currentMessages;
  }

  return sortMessagesByCreatedAtAsc([
    ...currentMessages,
    {
      id: payload.message.id,
      body: payload.message.body,
      createdAt: payload.message.createdAt,
      senderProfileId: payload.message.sender.id,
      senderDisplayName: payload.message.sender.displayName
    }
  ]);
}

export function toMobileConversationSummary(
  realtimeConversation: MobileRealtimeConversationSummary
): MobileConversationSummary {
  const listingTitle = realtimeConversation.contextListing?.title?.trim() ?? "";
  const displayName = realtimeConversation.otherProfile.displayName.trim();
  const latestBody = realtimeConversation.latestMessage?.body.trim() ?? "";

  return {
    id: realtimeConversation.id,
    title: listingTitle || displayName || "Konuşma",
    subtitle: listingTitle && displayName ? displayName : "BabyLoop mesajlaşma",
    latestMessageText: latestBody || "Henüz mesaj yok.",
    unreadCount: Math.max(0, realtimeConversation.unreadCount),
    updatedAt:
      realtimeConversation.lastMessageAt ??
      realtimeConversation.updatedAt ??
      realtimeConversation.createdAt ??
      null
  };
}

function sortConversationsByUpdatedAtDesc(
  conversations: MobileConversationSummary[]
): MobileConversationSummary[] {
  return [...conversations].sort((left, right) => {
    return getDateTime(right.updatedAt) - getDateTime(left.updatedAt);
  });
}

function sortMessagesByCreatedAtAsc(
  messages: MobileConversationMessage[]
): MobileConversationMessage[] {
  return [...messages].sort((left, right) => {
    return getDateTime(left.createdAt) - getDateTime(right.createdAt);
  });
}

function getDateTime(value: string | null): number {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}
