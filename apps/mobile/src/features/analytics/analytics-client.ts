import Constants from "expo-constants";
import { Platform } from "react-native";
import type { AnalyticsEventEnvelope, AnalyticsEventName, AnalyticsProperty } from "@babyloop/shared";

import {
  buildMobileAnalyticsEvent,
  takeMobileAnalyticsBatch
} from "./analytics-event-model";
import { clampMobileEngagementDelta } from "./analytics-session-model";
import {
  appendStoredMobileAnalyticsEvent,
  getStoredMobileAnalyticsQueue,
  setStoredMobileAnalyticsQueue
} from "./analytics-storage";
import { sendMobileAnalyticsBatch } from "./analytics-api";

export type MobileAnalyticsTrackInput = {
  eventName: AnalyticsEventName;
  properties?: Record<string, AnalyticsProperty>;
  screenName?: string;
};

export type MobileAnalyticsClientOptions = {
  anonymousId: string;
  getSessionId: () => string;
  getScreenName: () => string;
  randomId?: () => string;
};

export class MobileAnalyticsClient {
  private flushPromise: Promise<void> | null = null;
  private retryAfter = 0;

  constructor(private readonly options: MobileAnalyticsClientOptions) {}

  async track(input: MobileAnalyticsTrackInput): Promise<void> {
    const event = buildMobileAnalyticsEvent({
      anonymousId: this.options.anonymousId,
      appVersion: getMobileAppVersion(),
      eventId: this.options.randomId?.() ?? createMobileRandomId(),
      eventName: input.eventName,
      occurredAt: new Date(),
      properties: {
        ...(input.properties ?? {}),
        platformOS: Platform.OS
      },
      screenName: input.screenName ?? this.options.getScreenName(),
      sessionId: this.options.getSessionId()
    });

    await appendStoredMobileAnalyticsEvent(event);
  }

  async trackScreenView(screenName: string): Promise<void> {
    await this.track({
      eventName: "screen_viewed",
      properties: {
        screenName
      },
      screenName
    });
  }

  async trackEngagement(screenName: string, deltaMs: number): Promise<void> {
    const engagementMs = clampMobileEngagementDelta(deltaMs);

    if (engagementMs <= 0) {
      return;
    }

    await this.track({
      eventName: "engagement_heartbeat",
      properties: {
        engagementMs,
        screenName
      },
      screenName
    });
  }

  flush(): Promise<void> {
    if (this.flushPromise) {
      return this.flushPromise;
    }

    this.flushPromise = this.flushInternal().finally(() => {
      this.flushPromise = null;
    });

    return this.flushPromise;
  }

  private async flushInternal(): Promise<void> {
    if (Date.now() < this.retryAfter) {
      return;
    }

    const queue = await getStoredMobileAnalyticsQueue();

    if (queue.length === 0) {
      return;
    }

    const { batch, remaining } = takeMobileAnalyticsBatch<AnalyticsEventEnvelope>(queue);
    const response = await sendMobileAnalyticsBatch(batch);

    if (!response.ok) {
      this.retryAfter = Date.now() + 10_000;
      return;
    }

    this.retryAfter = 0;
    await setStoredMobileAnalyticsQueue(remaining);
  }
}

export function createMobileRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getMobileAppVersion(): string | undefined {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? undefined;
}
