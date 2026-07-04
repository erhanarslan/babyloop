import { describe, expect, it } from "vitest";
import {
  REALTIME_EVENTS,
  realtimeConversationRoom,
  realtimeProfileRoom,
  type ConversationUpdatedPayload,
  type MessageCreatedPayload,
  type NotificationCreatedPayload,
  type RealtimeClientToServerEvents,
  type RealtimeServerToClientEvents
} from "../src/realtime.js";

describe("realtime contracts", () => {
  it("keeps stable event names", () => {
    expect(REALTIME_EVENTS).toEqual({
      conversationJoin: "conversation:join",
      conversationLeave: "conversation:leave",
      conversationUpdated: "conversation:updated",
      messageCreated: "message:created",
      loginApprovalCreated: "login_approval:created",
      notificationCreated: "notification:created",
      notificationRead: "notification:read",
      notificationReadAll: "notification:read_all",
      notificationUnreadCountUpdated: "notification:unread_count_updated",
      realtimeError: "realtime:error"
    });
  });

  it("builds stable room names", () => {
    expect(realtimeProfileRoom("profile-1")).toBe("profile:profile-1");
    expect(realtimeConversationRoom("conversation-1")).toBe("conversation:conversation-1");
  });

  it("accepts the documented message payload shape", () => {
    const payload = {
      conversationId: "conversation-1",
      message: {
        id: "message-1",
        conversationId: "conversation-1",
        sender: {
          id: "profile-1",
          displayName: "Ada"
        },
        body: "Merhaba",
        createdAt: "2026-06-05T09:00:00.000Z",
        deletedAt: null
      }
    } satisfies MessageCreatedPayload;

    expect(payload.message.body).toBe("Merhaba");
  });

  it("accepts the documented conversation update payload shape", () => {
    const payload = {
      conversationId: "conversation-1",
      conversation: {
        id: "conversation-1",
        otherProfile: {
          id: "profile-2",
          displayName: "Mert"
        },
        contextListing: {
          id: "listing-1",
          title: "Bebek arabasi"
        },
        latestMessage: {
          body: "Uygun mudur?",
          senderProfileId: "profile-2",
          createdAt: "2026-06-05T09:00:00.000Z"
        },
        unreadCount: 1,
        status: "active",
        lastMessageAt: "2026-06-05T09:00:00.000Z",
        createdAt: "2026-06-05T08:00:00.000Z",
        updatedAt: "2026-06-05T09:00:00.000Z"
      }
    } satisfies ConversationUpdatedPayload;

    expect(payload.conversation.latestMessage?.senderProfileId).toBe("profile-2");
  });

  it("accepts the documented notification created payload shape", () => {
    const payload = {
      notification: {
        id: "notification-1",
        recipientProfileId: "profile-2",
        actorProfile: {
          id: "profile-1",
          displayName: "Ada"
        },
        type: "message_received",
        title: "New message",
        body: "Ada: Merhaba",
        entityType: "conversation",
        entityId: "conversation-1",
        metadata: {
          messageId: "message-1"
        },
        readAt: null,
        createdAt: "2026-06-05T09:00:00.000Z"
      },
      unreadCount: 1
    } satisfies NotificationCreatedPayload;

    expect(payload.notification.type).toBe("message_received");
    expect(payload.unreadCount).toBe(1);
  });

  it("exposes typed client and server event maps", () => {
    const joinHandler: RealtimeClientToServerEvents["conversation:join"] = (payload) => {
      expect(payload.conversationId).toBe("conversation-1");
    };
    const messageHandler: RealtimeServerToClientEvents["message:created"] = (payload) => {
      expect(payload.conversationId).toBe("conversation-1");
    };
    const notificationHandler: RealtimeServerToClientEvents["notification:created"] = (payload) => {
      expect(payload.unreadCount).toBe(1);
    };

    joinHandler({ conversationId: "conversation-1" });
    messageHandler({
      conversationId: "conversation-1",
      message: {
        id: "message-1",
        conversationId: "conversation-1",
        sender: {
          id: "profile-1",
          displayName: "Ada"
        },
        body: "Merhaba",
        createdAt: "2026-06-05T09:00:00.000Z",
        deletedAt: null
      }
    });
    notificationHandler({
      notification: {
        id: "notification-1",
        recipientProfileId: "profile-2",
        actorProfile: null,
        type: "system",
        title: "System",
        body: "Hello",
        entityType: null,
        entityId: null,
        metadata: {},
        readAt: null,
        createdAt: "2026-06-05T09:00:00.000Z"
      },
      unreadCount: 1
    });
  });
});
