import {
  canSendMobileConversationMessage,
  getMobileConversationListingContext,
  getMobileConversationMessageCharacterCount
} from "./conversation-detail-model";
import type { MobileConversationDetail } from "./messages-api";

describe("conversation detail model", () => {
  it("builds listing context copy for reserved conversations", () => {
    const conversation = conversationDetail({
      listingStatus: "reserved"
    });

    expect(getMobileConversationListingContext(conversation)).toEqual({
      title: "Kanguru",
      subtitle: "Ada Parent ile rezerve görünen bu ilan hakkında konuşuyorsun.",
      statusText: "Rezerve",
      actionLabel: "İlanı aç",
      canOpenListing: true,
      tone: "warning"
    });
  });

  it("returns null listing context when conversation has no listing id", () => {
    expect(getMobileConversationListingContext({
      ...conversationDetail({}),
      listingId: null,
      listingTitle: null
    })).toBeNull();
  });

  it("guards message send action", () => {
    expect(canSendMobileConversationMessage({
      body: "Merhaba, ürün uygun mu?",
      conversationId: "conversation-1",
      sending: false
    })).toBe(true);

    expect(canSendMobileConversationMessage({
      body: "   ",
      conversationId: "conversation-1",
      sending: false
    })).toBe(false);

    expect(canSendMobileConversationMessage({
      body: "Merhaba",
      conversationId: "",
      sending: false
    })).toBe(false);

    expect(canSendMobileConversationMessage({
      body: "Merhaba",
      conversationId: "conversation-1",
      sending: true
    })).toBe(false);
  });

  it("reports message character count", () => {
    expect(getMobileConversationMessageCharacterCount("abc")).toEqual({
      length: 3,
      remaining: 497,
      isOverLimit: false
    });

    expect(getMobileConversationMessageCharacterCount("x".repeat(501))).toEqual({
      length: 501,
      remaining: -1,
      isOverLimit: true
    });
  });
});

function conversationDetail(input: Partial<MobileConversationDetail>): MobileConversationDetail {
  return {
    id: "conversation-1",
    title: "Kanguru",
    subtitle: "Ada Parent",
    latestMessageText: "Henüz mesaj yok.",
    unreadCount: 0,
    updatedAt: "2026-01-01T10:00:00.000Z",
    listingId: "listing-1",
    listingTitle: "Kanguru",
    listingStatus: null,
    otherProfileDisplayName: "Ada Parent",
    ...input
  };
}
