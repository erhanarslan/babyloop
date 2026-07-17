"use client";

import { createContext, useContext } from "react";
import type { AnalyticsEventName, AnalyticsProperty } from "@babyloop/shared";

export type AnalyticsContextValue = {
  track: (input: {
    eventName: AnalyticsEventName;
    pathname?: string;
    properties?: Record<string, AnalyticsProperty>;
  }) => void;
  trackListingImpression: (input: { listingId: string; categoryId?: string; sourceSurface: string }) => void;
  trackListingOpened: (input: { listingId: string; categoryId?: string; sourceSurface: string }) => void;
  trackFavoriteChanged: (input: { listingId: string; categoryId?: string; favorited: boolean; sourceSurface: string }) => void;
  trackConversationOpened: (input: { conversationId: string; listingId?: string; sourceSurface: string }) => void;
  trackAssistantOpened: () => void;
  trackAssistantAnswer: (input: { mode: string; grounded: boolean; sourceCount: number; latencyBucket?: string }) => void;
  trackAiDraftRequested: (input: { sourceSurface: string }) => void;
  trackAiDraftApplied: (input: { sourceSurface: string }) => void;
  trackCartChanged: (input: { listingId: string; added: boolean; sourceSurface: string }) => void;
  trackCheckoutStarted: () => void;
  trackChildProfileOpened: (input: { sourceSurface: string }) => void;
  trackReminderChanged: (input: { scheduleKind: string; action: "created" | "updated" | "deleted" }) => void;
};

export const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function useAnalytics(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext);

  if (!context) {
    return noopAnalytics;
  }

  return context;
}

const noopAnalytics: AnalyticsContextValue = {
  track: () => undefined,
  trackAiDraftApplied: () => undefined,
  trackAiDraftRequested: () => undefined,
  trackAssistantAnswer: () => undefined,
  trackAssistantOpened: () => undefined,
  trackCartChanged: () => undefined,
  trackCheckoutStarted: () => undefined,
  trackChildProfileOpened: () => undefined,
  trackConversationOpened: () => undefined,
  trackFavoriteChanged: () => undefined,
  trackListingImpression: () => undefined,
  trackListingOpened: () => undefined,
  trackReminderChanged: () => undefined
};
