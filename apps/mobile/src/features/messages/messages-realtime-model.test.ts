import {
  appendRealtimeMessage,
  mergeRealtimeConversationDetail,
  mergeRealtimeConversationSummary
} from "./messages-realtime-model";
import type { MobileConversationDetail, MobileConversationSummary } from "./messages-api";
import type {
  MobileMessageCreatedPayload,
  MobileRealtimeConversationSummary
} from "../realtime/mobile-realtime";

describe("messages realtime model", () => {
  it("merges a conversation update and keeps the newest conversation first", () => {
    const existing: MobileConversationSummary[] = [
      {
        id: "conversation-old",
        title: "Eski ilan",
        subtitle: "Ada",
        latestMessageText: "Eski mesaj",
        unreadCount: 0,
        updatedAt: "2026-01-01T10:00:00.000Z"
      },
      {
        id: "conversation-live",
        title: "Önceki başlık",
        subtitle: "Önceki kullanıcı",
        latestMessageText: "Önceki mesaj",
        unreadCount: 1,
        updatedAt: "2026-01-01T09:00:00.000Z"
      }
    ];

    const merged = mergeRealtimeConversationSummary(existing, realtimeConversation({
      id: "conversation-live",
      latestBody: "Yeni mesaj",
      lastMessageAt: "2026-01-01T11:00:00.000Z",
      unreadCount: 3
    }));

    expect(merged).toEqual([
      {
        id: "conversation-live",
        title: "Kanguru",
        subtitle: "Ada Parent",
        latestMessageText: "Yeni mesaj",
        unreadCount: 3,
        updatedAt: "2026-01-01T11:00:00.000Z"
      },
      existing[0]
    ]);
  });

  it("appends realtime messages for the active conversation and ignores duplicates", () => {
    const payload: MobileMessageCreatedPayload = {
      conversationId: "conversation-1",
      message: {
        id: "message-2",
        conversationId: "conversation-1",
        body: "Merhaba, ürün hâlâ uygun mu?",
        createdAt: "2026-01-01T10:01:00.000Z",
        deletedAt: null,
        sender: {
          id: "profile-2",
          displayName: "Ada Parent"
        }
      }
    };

    const current = [
      {
        id: "message-1",
        body: "Selam",
        createdAt: "2026-01-01T10:00:00.000Z",
        senderProfileId: "profile-1",
        senderDisplayName: "Seller"
      }
    ];

    const appended = appendRealtimeMessage(current, payload, "conversation-1");
    const duplicated = appendRealtimeMessage(appended, payload, "conversation-1");
    const unrelated = appendRealtimeMessage(appended, {
      ...payload,
      conversationId: "conversation-2"
    }, "conversation-1");

    expect(appended).toHaveLength(2);
    expect(appended[1]).toEqual({
      id: "message-2",
      body: "Merhaba, ürün hâlâ uygun mu?",
      createdAt: "2026-01-01T10:01:00.000Z",
      senderProfileId: "profile-2",
      senderDisplayName: "Ada Parent"
    });
    expect(duplicated).toBe(appended);
    expect(unrelated).toBe(appended);
  });

  it("merges conversation detail without losing detail-only listing fields", () => {
    const current: MobileConversationDetail = {
      id: "conversation-live",
      title: "Eski başlık",
      subtitle: "Eski kişi",
      latestMessageText: "Eski mesaj",
      unreadCount: 0,
      updatedAt: "2026-01-01T09:00:00.000Z",
      listingId: "listing-existing",
      listingTitle: "Mevcut ilan",
      otherProfileDisplayName: "Mevcut kullanıcı"
    };

    const merged = mergeRealtimeConversationDetail(current, realtimeConversation({
      id: "conversation-live",
      latestBody: "Detayda canlı mesaj",
      lastMessageAt: "2026-01-01T12:00:00.000Z",
      unreadCount: 2
    }));

    expect(merged).toMatchObject({
      id: "conversation-live",
      title: "Kanguru",
      subtitle: "Ada Parent",
      latestMessageText: "Detayda canlı mesaj",
      unreadCount: 2,
      updatedAt: "2026-01-01T12:00:00.000Z",
      listingId: "listing-existing",
      listingTitle: "Kanguru",
      otherProfileDisplayName: "Ada Parent"
    });
  });
});

function realtimeConversation(input: {
  id: string;
  latestBody: string;
  lastMessageAt: string;
  unreadCount: number;
}): MobileRealtimeConversationSummary {
  return {
    id: input.id,
    otherProfile: {
      id: "profile-2",
      displayName: "Ada Parent"
    },
    contextListing: {
      id: "listing-1",
      title: "Kanguru"
    },
    latestMessage: {
      body: input.latestBody,
      createdAt: input.lastMessageAt,
      senderProfileId: "profile-2"
    },
    unreadCount: input.unreadCount,
    status: "active",
    lastMessageAt: input.lastMessageAt,
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: input.lastMessageAt
  };
}
