"use client";

import type { AnalyticsEventEnvelope, AnalyticsEventName, AnalyticsProperty } from "@babyloop/shared";

import { buildWebAnalyticsEvent, clampEngagementDelta, templateWebPath } from "./analytics-event-model";
import { sendWebAnalyticsBatch, sendWebAnalyticsBeacon } from "./analytics-api";

const WEB_ANALYTICS_QUEUE_LIMIT = 200;
const WEB_ANALYTICS_BATCH_LIMIT = 30;

export type WebAnalyticsTrackInput = {
  eventName: AnalyticsEventName;
  pathname?: string;
  properties?: Record<string, AnalyticsProperty>;
};

export type WebAnalyticsClientOptions = {
  anonymousId: string;
  getNow?: () => Date;
  getSessionId: () => string;
  randomId?: () => string;
};

export class WebAnalyticsClient {
  private flushPromise: Promise<void> | null = null;
  private queue: AnalyticsEventEnvelope[] = [];
  private retryAfter = 0;

  constructor(private readonly options: WebAnalyticsClientOptions) {}

  track(input: WebAnalyticsTrackInput): void {
    const occurredAt = this.options.getNow?.() ?? new Date();
    const pathname = input.pathname ?? (typeof window !== "undefined" ? window.location.pathname : undefined);
    const event = buildWebAnalyticsEvent({
      anonymousId: this.options.anonymousId,
      eventId: this.options.randomId?.() ?? createRandomId(),
      eventName: input.eventName,
      occurredAt,
      sessionId: this.options.getSessionId(),
      ...(pathname ? { pathname } : {}),
      ...(input.properties ? { properties: input.properties } : {})
    });

    this.enqueue(event);
  }

  trackPageView(pathname: string): void {
    this.track({
      eventName: "page_viewed",
      pathname,
      properties: {
        pageGroup: getPageGroup(pathname),
        routeTemplate: templateWebPath(pathname)
      }
    });
  }

  trackEngagement(pathname: string, deltaMs: number): void {
    const engagementMs = clampEngagementDelta(deltaMs);

    if (engagementMs <= 0) {
      return;
    }

    this.track({
      eventName: "engagement_heartbeat",
      pathname,
      properties: {
        engagementMs,
        routeTemplate: templateWebPath(pathname)
      }
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

  flushBeacon(): void {
    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.slice(0, WEB_ANALYTICS_BATCH_LIMIT);

    if (sendWebAnalyticsBeacon(batch)) {
      this.queue = this.queue.slice(batch.length);
    }
  }

  private enqueue(event: AnalyticsEventEnvelope): void {
    this.queue = [...this.queue, event].slice(-WEB_ANALYTICS_QUEUE_LIMIT);

    if (this.queue.length >= WEB_ANALYTICS_BATCH_LIMIT) {
      void this.flush();
    }
  }

  private async flushInternal(): Promise<void> {
    if (this.queue.length === 0 || Date.now() < this.retryAfter) {
      return;
    }

    const batch = this.queue.slice(0, WEB_ANALYTICS_BATCH_LIMIT);
    const response = await sendWebAnalyticsBatch(batch);

    if (!response.ok) {
      this.retryAfter = Date.now() + 10_000;
      return;
    }

    this.retryAfter = 0;
    this.queue = this.queue.slice(batch.length);
  }
}

export function createRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getPageGroup(pathname: string): string {
  const routeTemplate = templateWebPath(pathname);

  if (routeTemplate === "/") {
    return "home";
  }

  return routeTemplate.split("/").filter(Boolean)[0] ?? "home";
}
