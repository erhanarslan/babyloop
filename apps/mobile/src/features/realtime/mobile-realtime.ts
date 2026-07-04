import { io, type Socket } from "socket.io-client";

import { getApiBaseUrl } from "../../config/api";
import {
  getMobileAuthToken,
  hydrateMobileAuthToken,
  type MobileLoginApprovalChallenge
} from "../auth/auth-api";

export const MOBILE_REALTIME_EVENTS = {
  conversationJoin: "conversation:join",
  conversationLeave: "conversation:leave",
  conversationUpdated: "conversation:updated",
  messageCreated: "message:created",
  loginApprovalCreated: "login_approval:created",
  realtimeError: "realtime:error"
} as const;

export type MobileRealtimeErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_PAYLOAD"
  | "NOT_FOUND"
  | "SERVER_ERROR";

export type MobileRealtimeErrorPayload = {
  code: MobileRealtimeErrorCode;
  message: string;
};

export type MobileRealtimeConversationRoomPayload = {
  conversationId: string;
};

export type MobileRealtimeMessage = {
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

export type MobileRealtimeConversationSummary = {
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
  unreadCount: number;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobileMessageCreatedPayload = {
  conversationId: string;
  message: MobileRealtimeMessage;
};

export type MobileConversationUpdatedPayload = {
  conversationId: string;
  conversation: MobileRealtimeConversationSummary;
};

export type MobileLoginApprovalCreatedPayload = {
  approval: MobileLoginApprovalChallenge;
};

export type MobileRealtimeClientToServerEvents = {
  [MOBILE_REALTIME_EVENTS.conversationJoin]: (payload: MobileRealtimeConversationRoomPayload) => void;
  [MOBILE_REALTIME_EVENTS.conversationLeave]: (payload: MobileRealtimeConversationRoomPayload) => void;
};

export type MobileRealtimeServerToClientEvents = {
  [MOBILE_REALTIME_EVENTS.conversationUpdated]: (payload: MobileConversationUpdatedPayload) => void;
  [MOBILE_REALTIME_EVENTS.messageCreated]: (payload: MobileMessageCreatedPayload) => void;
  [MOBILE_REALTIME_EVENTS.loginApprovalCreated]: (payload: MobileLoginApprovalCreatedPayload) => void;
  [MOBILE_REALTIME_EVENTS.realtimeError]: (payload: MobileRealtimeErrorPayload) => void;
};

export type MobileRealtimeSocket = Socket<
  MobileRealtimeServerToClientEvents,
  MobileRealtimeClientToServerEvents
>;

export type MobileRealtimeCallbacks = {
  onConversationUpdated?: (payload: MobileConversationUpdatedPayload) => void;
  onMessageCreated?: (payload: MobileMessageCreatedPayload) => void;
  onLoginApprovalCreated?: (payload: MobileLoginApprovalCreatedPayload) => void;
  onRealtimeError?: (payload: MobileRealtimeErrorPayload) => void;
};

export type MobileRealtimeSubscription = {
  connected: boolean;
  socket: MobileRealtimeSocket | null;
  unsubscribe: () => void;
};

let mobileRealtimeSocket: MobileRealtimeSocket | null = null;
let mobileRealtimeSocketToken: string | null = null;

export async function ensureMobileRealtimeSocket(): Promise<MobileRealtimeSocket | null> {
  const token = getMobileAuthToken() ?? await hydrateMobileAuthToken();

  if (!token) {
    disconnectMobileRealtimeSocket();
    return null;
  }

  if (mobileRealtimeSocket && mobileRealtimeSocketToken === token) {
    if (!mobileRealtimeSocket.connected) {
      mobileRealtimeSocket.connect();
    }

    return mobileRealtimeSocket;
  }

  disconnectMobileRealtimeSocket();

  mobileRealtimeSocketToken = token;
  mobileRealtimeSocket = io(getApiBaseUrl(), {
    auth: {
      token
    },
    autoConnect: false,
    reconnection: true,
    transports: ["websocket"]
  });

  mobileRealtimeSocket.connect();

  return mobileRealtimeSocket;
}

export function disconnectMobileRealtimeSocket(): void {
  if (mobileRealtimeSocket) {
    mobileRealtimeSocket.removeAllListeners();
    mobileRealtimeSocket.disconnect();
  }

  mobileRealtimeSocket = null;
  mobileRealtimeSocketToken = null;
}

export async function subscribeMobileRealtime(
  callbacks: MobileRealtimeCallbacks
): Promise<MobileRealtimeSubscription> {
  const socket = await ensureMobileRealtimeSocket();

  if (!socket) {
    return {
      connected: false,
      socket: null,
      unsubscribe: () => undefined
    };
  }

  if (callbacks.onConversationUpdated) {
    socket.on(MOBILE_REALTIME_EVENTS.conversationUpdated, callbacks.onConversationUpdated);
  }

  if (callbacks.onMessageCreated) {
    socket.on(MOBILE_REALTIME_EVENTS.messageCreated, callbacks.onMessageCreated);
  }

  if (callbacks.onLoginApprovalCreated) {
    socket.on(MOBILE_REALTIME_EVENTS.loginApprovalCreated, callbacks.onLoginApprovalCreated);
  }

  if (callbacks.onRealtimeError) {
    socket.on(MOBILE_REALTIME_EVENTS.realtimeError, callbacks.onRealtimeError);
  }

  return {
    connected: true,
    socket,
    unsubscribe: () => {
      if (callbacks.onConversationUpdated) {
        socket.off(MOBILE_REALTIME_EVENTS.conversationUpdated, callbacks.onConversationUpdated);
      }

      if (callbacks.onMessageCreated) {
        socket.off(MOBILE_REALTIME_EVENTS.messageCreated, callbacks.onMessageCreated);
      }

      if (callbacks.onLoginApprovalCreated) {
        socket.off(MOBILE_REALTIME_EVENTS.loginApprovalCreated, callbacks.onLoginApprovalCreated);
      }

      if (callbacks.onRealtimeError) {
        socket.off(MOBILE_REALTIME_EVENTS.realtimeError, callbacks.onRealtimeError);
      }
    }
  };
}
