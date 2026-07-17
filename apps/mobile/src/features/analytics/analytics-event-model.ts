import {
  getAllowedAnalyticsProperties,
  type AnalyticsEventEnvelope,
  type AnalyticsEventName,
  type AnalyticsProperty
} from "@babyloop/shared";

export const MOBILE_ANALYTICS_QUEUE_LIMIT = 500;
export const MOBILE_ANALYTICS_BATCH_LIMIT = 50;

export function buildMobileAnalyticsEvent(input: {
  anonymousId: string;
  appVersion?: string;
  eventId: string;
  eventName: AnalyticsEventName;
  occurredAt: Date;
  properties?: Record<string, AnalyticsProperty>;
  screenName: string;
  sessionId: string;
}): AnalyticsEventEnvelope {
  return {
    anonymousId: input.anonymousId,
    eventId: input.eventId,
    eventName: input.eventName,
    eventVersion: 1,
    occurredAt: input.occurredAt.toISOString(),
    platform: "mobile",
    screenName: sanitizeScreenName(input.screenName),
    sessionId: input.sessionId,
    ...(input.appVersion ? { appVersion: input.appVersion } : {}),
    properties: sanitizeMobileAnalyticsProperties(input.eventName, input.properties ?? {})
  };
}

export function sanitizeMobileAnalyticsProperties(
  eventName: AnalyticsEventName,
  properties: Record<string, AnalyticsProperty>
): Record<string, AnalyticsProperty> {
  const allowed = new Set(getAllowedAnalyticsProperties(eventName));
  const output: Record<string, AnalyticsProperty> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key)) {
      continue;
    }

    output[key] = typeof value === "string" ? value.slice(0, 240) : value;
  }

  return output;
}

export function enqueueMobileAnalyticsEvent<T>(
  queue: T[],
  event: T,
  limit = MOBILE_ANALYTICS_QUEUE_LIMIT
): T[] {
  const nextQueue = [...queue, event];
  return nextQueue.length > limit ? nextQueue.slice(nextQueue.length - limit) : nextQueue;
}

export function takeMobileAnalyticsBatch<T>(
  queue: T[],
  limit = MOBILE_ANALYTICS_BATCH_LIMIT
): { batch: T[]; remaining: T[] } {
  return {
    batch: queue.slice(0, limit),
    remaining: queue.slice(limit)
  };
}

function sanitizeScreenName(screenName: string): string {
  const normalized = screenName.trim().replace(/[^a-z0-9_]/giu, "_").toLowerCase();
  return normalized.slice(0, 120) || "unknown";
}
