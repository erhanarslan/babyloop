import {
  getMobileMessagesTabBadgeLabel,
  getMobileUnreadConversationCount
} from "./messages-tab-badge-model";

describe("messages tab badge model", () => {
  it("sums unread conversations and hides the badge when there is no unread message", () => {
    expect(getMobileUnreadConversationCount([{ unreadCount: 0 }, { unreadCount: 2 }, { unreadCount: 1 }])).toBe(3);
    expect(getMobileMessagesTabBadgeLabel([{ unreadCount: 0 }])).toBeUndefined();
    expect(getMobileMessagesTabBadgeLabel([{ unreadCount: 1 }])).toBe("1");
  });

  it("caps large unread counts for the tab badge", () => {
    expect(getMobileMessagesTabBadgeLabel([{ unreadCount: 80 }, { unreadCount: 25 }])).toBe("99+");
  });
});
