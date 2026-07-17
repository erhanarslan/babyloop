import { createContext, useContext } from "react";
import type { AnalyticsEventName, AnalyticsProperty } from "@babyloop/shared";

export type MobileAnalyticsContextValue = {
  track: (input: {
    eventName: AnalyticsEventName;
    properties?: Record<string, AnalyticsProperty>;
    screenName?: string;
  }) => void;
  trackListingOpened: (input: { listingId: string; categoryId?: string; sourceSurface: string }) => void;
  trackFavoriteChanged: (input: { listingId: string; categoryId?: string; favorited: boolean; sourceSurface: string }) => void;
  trackConversationOpened: (input: { conversationId: string; listingId?: string; sourceSurface: string }) => void;
  trackAssistantOpened: () => void;
  trackAssistantAnswer: (input: { mode: string; grounded: boolean; sourceCount: number }) => void;
  trackAiDraftRequested: (input: { imageCountBucket?: string; hasTextHints?: boolean }) => void;
  trackAiDraftApplied: (input: { appliedFieldCount: number }) => void;
  trackCartChanged: (input: { listingId: string; added: boolean; sourceSurface: string }) => void;
  trackChildProfileOpened: (input: { ageBand?: string; sourceSurface: string }) => void;
  trackReminderChanged: (input: { scheduleKind: string; action: "created" | "updated" | "deleted" }) => void;
};

export const MobileAnalyticsContext = createContext<MobileAnalyticsContextValue | null>(null);

export function useMobileAnalytics(): MobileAnalyticsContextValue {
  return useContext(MobileAnalyticsContext) ?? noopMobileAnalytics;
}

const noopMobileAnalytics: MobileAnalyticsContextValue = {
  track: () => undefined,
  trackAiDraftApplied: () => undefined,
  trackAiDraftRequested: () => undefined,
  trackAssistantAnswer: () => undefined,
  trackAssistantOpened: () => undefined,
  trackCartChanged: () => undefined,
  trackChildProfileOpened: () => undefined,
  trackConversationOpened: () => undefined,
  trackFavoriteChanged: () => undefined,
  trackListingOpened: () => undefined,
  trackReminderChanged: () => undefined
};
