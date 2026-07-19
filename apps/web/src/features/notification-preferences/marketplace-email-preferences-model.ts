import type { NotificationPreference } from "./api";

export type MarketplaceEmailPreferenceSource = "messages" | "listing";

export const marketplaceEmailPreferenceDefinitions: ReadonlyArray<{
  source: MarketplaceEmailPreferenceSource;
  title: string;
  description: string;
}> = [
  {
    source: "messages",
    title: "Yeni mesajlar",
    description: "Yeni bir mesaj aldığında e-posta gönder. Mesaj içeriğin e-postada paylaşılmaz."
  },
  {
    source: "listing",
    title: "İlan favorileri",
    description: "İlanlarından biri favoriye eklendiğinde e-posta gönder."
  }
];

export function findMarketplaceEmailPreference(
  preferences: NotificationPreference[],
  source: MarketplaceEmailPreferenceSource
): NotificationPreference | null {
  return preferences.find((item) => item.source === source && item.channel === "email") ?? null;
}

export function replaceNotificationPreference(
  preferences: NotificationPreference[],
  preference: NotificationPreference
): NotificationPreference[] {
  return preferences.map((item) => (
    item.source === preference.source && item.channel === preference.channel ? preference : item
  ));
}
