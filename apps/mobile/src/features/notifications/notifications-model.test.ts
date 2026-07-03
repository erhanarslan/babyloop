import {
  formatNotificationDate,
  getMobileNotificationCards,
  getMobileUnreadNotificationCountLabel,
  getNotificationActionLabel
} from "./notifications-model";
import type { MobileNotification } from "./notifications-api";

describe("mobile notifications model", () => {
  it("maps API notifications to safe display cards", () => {
    const notifications: MobileNotification[] = [
      {
        id: "notification-1",
        recipientProfileId: "profile-1",
        actorProfile: null,
        type: "system",
        title: "Ada için Oyuncak önerileri",
        body: "12-24 ay döneminde Oyuncak aramalarını takip etmek pratik olabilir. Bu bir sağlık, tedavi, diyet veya tanı önerisi değildir.",
        entityType: "child_profile",
        entityId: "child-1",
        metadata: {
          source: "child_lifecycle"
        },
        readAt: null,
        createdAt: "2030-01-01T10:00:00.000Z"
      }
    ];

    const cards = getMobileNotificationCards(notifications);

    expect(cards[0]).toMatchObject({
      id: "notification-1",
      title: "Ada için Oyuncak önerileri",
      unread: true,
      actionLabel: "Çocuğum sayfasına git",
      source: "child_lifecycle"
    });
    expect(JSON.stringify(cards)).not.toMatch(/accessToken|refreshToken|passwordHash|email@/iu);
    expect(JSON.stringify(cards)).not.toMatch(/tedavi planı|tanı koy|diyet reçetesi|terapi seansı/iu);
  });

  it("formats unread count labels", () => {
    expect(getMobileUnreadNotificationCountLabel(0)).toBe("Okunmamış bildirim yok");
    expect(getMobileUnreadNotificationCountLabel(3)).toBe("3 okunmamış bildirim");
  });

  it("formats action labels by entity type", () => {
    expect(getNotificationActionLabel({ entityType: "conversation" })).toBe("Konuşmayı aç");
    expect(getNotificationActionLabel({ entityType: "listing" })).toBe("İlanı aç");
    expect(getNotificationActionLabel({ entityType: "child_profile" })).toBe("Çocuğum sayfasına git");
    expect(getNotificationActionLabel({ entityType: null })).toBeNull();
  });

  it("formats invalid dates safely", () => {
    expect(formatNotificationDate("not-a-date")).toBe("");
  });
});
