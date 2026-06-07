export const REALTIME_EVENTS = {
  conversationJoin: "conversation:join",
  conversationLeave: "conversation:leave",
  conversationUpdated: "conversation:updated",
  messageCreated: "message:created",
  notificationCreated: "notification:created",
  notificationRead: "notification:read",
  notificationReadAll: "notification:read_all",
  notificationUnreadCountUpdated: "notification:unread_count_updated",
  realtimeError: "realtime:error"
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export type RealtimeErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_PAYLOAD"
  | "NOT_FOUND"
  | "SERVER_ERROR";

export type RealtimeErrorPayload = {
  code: RealtimeErrorCode;
  message: string;
};

export type RealtimeConversationRoomPayload = {
  conversationId: string;
};

export type RealtimeMessage = {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    displayName: string;
  };
  body: string;
  createdAt: string;
  deletedAt: string | null;
};

export type RealtimeConversationSummary = {
  id: string;
  otherProfile: {
    id: string;
    displayName: string;
  };
  contextListing: {
    id: string;
    title: string;
  } | null;
  latestMessage: {
    body: string;
    senderProfileId: string;
    createdAt: string;
  } | null;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RealtimeNotificationType =
  | "message_received"
  | "listing_favorited"
  | "listing_status_changed"
  | "system";

export type RealtimeNotificationActorProfile = {
  id: string;
  displayName: string;
} | null;

export type RealtimeNotification = {
  id: string;
  recipientProfileId: string;
  actorProfile: RealtimeNotificationActorProfile;
  type: RealtimeNotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type MessageCreatedPayload = {
  conversationId: string;
  message: RealtimeMessage;
};

export type ConversationUpdatedPayload = {
  conversationId: string;
  conversation: RealtimeConversationSummary;
};

export type NotificationCreatedPayload = {
  notification: RealtimeNotification;
  unreadCount: number;
};

export type NotificationReadPayload = {
  notificationId: string;
  readAt: string;
  unreadCount: number;
};

export type NotificationReadAllPayload = {
  updatedCount: number;
  unreadCount: number;
};

export type NotificationUnreadCountUpdatedPayload = {
  unreadCount: number;
};

export type RealtimeClientToServerEvents = {
  [REALTIME_EVENTS.conversationJoin]: (payload: RealtimeConversationRoomPayload) => void;
  [REALTIME_EVENTS.conversationLeave]: (payload: RealtimeConversationRoomPayload) => void;
};

export type RealtimeServerToClientEvents = {
  [REALTIME_EVENTS.conversationUpdated]: (payload: ConversationUpdatedPayload) => void;
  [REALTIME_EVENTS.messageCreated]: (payload: MessageCreatedPayload) => void;
  [REALTIME_EVENTS.notificationCreated]: (payload: NotificationCreatedPayload) => void;
  [REALTIME_EVENTS.notificationRead]: (payload: NotificationReadPayload) => void;
  [REALTIME_EVENTS.notificationReadAll]: (payload: NotificationReadAllPayload) => void;
  [REALTIME_EVENTS.notificationUnreadCountUpdated]: (
    payload: NotificationUnreadCountUpdatedPayload
  ) => void;
  [REALTIME_EVENTS.realtimeError]: (payload: RealtimeErrorPayload) => void;
};

export function realtimeProfileRoom(profileId: string): string {
  return `profile:${profileId}`;
}

export function realtimeConversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}
