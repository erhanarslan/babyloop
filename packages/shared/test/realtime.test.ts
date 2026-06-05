import { describe, expect, it } from "vitest";
import {
  REALTIME_EVENTS,
  realtimeConversationRoom,
  realtimeProfileRoom,
  type ConversationUpdatedPayload,
  type MessageCreatedPayload,
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
        status: "active",
        lastMessageAt: "2026-06-05T09:00:00.000Z",
        createdAt: "2026-06-05T08:00:00.000Z",
        updatedAt: "2026-06-05T09:00:00.000Z"
      }
    } satisfies ConversationUpdatedPayload;

    expect(payload.conversation.latestMessage?.senderProfileId).toBe("profile-2");
  });

  it("exposes typed client and server event maps", () => {
    const joinHandler: RealtimeClientToServerEvents["conversation:join"] = (payload) => {
      expect(payload.conversationId).toBe("conversation-1");
    };
    const messageHandler: RealtimeServerToClientEvents["message:created"] = (payload) => {
      expect(payload.conversationId).toBe("conversation-1");
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
  });
});
