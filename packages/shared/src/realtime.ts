export const REALTIME_EVENTS = {
  conversationJoin: "conversation:join",
  conversationLeave: "conversation:leave",
  conversationUpdated: "conversation:updated",
  messageCreated: "message:created",
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

export type MessageCreatedPayload = {
  conversationId: string;
  message: RealtimeMessage;
};

export type ConversationUpdatedPayload = {
  conversationId: string;
  conversation: RealtimeConversationSummary;
};

export type RealtimeClientToServerEvents = {
  [REALTIME_EVENTS.conversationJoin]: (payload: RealtimeConversationRoomPayload) => void;
  [REALTIME_EVENTS.conversationLeave]: (payload: RealtimeConversationRoomPayload) => void;
};

export type RealtimeServerToClientEvents = {
  [REALTIME_EVENTS.conversationUpdated]: (payload: ConversationUpdatedPayload) => void;
  [REALTIME_EVENTS.messageCreated]: (payload: MessageCreatedPayload) => void;
  [REALTIME_EVENTS.realtimeError]: (payload: RealtimeErrorPayload) => void;
};

export function realtimeProfileRoom(profileId: string): string {
  return `profile:${profileId}`;
}

export function realtimeConversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}
