import {
  getAllowedAnalyticsProperties,
  type AnalyticsEventEnvelope,
  type AnalyticsEventName,
  type AnalyticsPlatform,
  type AnalyticsProperty
} from "@babyloop/shared";

const MAX_HEARTBEAT_DELTA_MS = 30_000;

export type BuildWebAnalyticsEventInput = {
  eventId: string;
  eventName: AnalyticsEventName;
  occurredAt: Date;
  platform?: AnalyticsPlatform;
  sessionId: string;
  anonymousId: string;
  pathname?: string;
  screenName?: string;
  appVersion?: string;
  properties?: Record<string, AnalyticsProperty>;
};

export function buildWebAnalyticsEvent(input: BuildWebAnalyticsEventInput): AnalyticsEventEnvelope {
  const properties = sanitizeProperties(input.eventName, input.properties ?? {});
  const routeTemplate = typeof properties.routeTemplate === "string"
    ? properties.routeTemplate
    : input.pathname
      ? templateWebPath(input.pathname)
      : undefined;

  return {
    anonymousId: input.anonymousId,
    eventId: input.eventId,
    eventName: input.eventName,
    eventVersion: 1,
    occurredAt: input.occurredAt.toISOString(),
    platform: input.platform ?? "web",
    sessionId: input.sessionId,
    ...(input.appVersion ? { appVersion: input.appVersion } : {}),
    ...(input.pathname ? { pagePath: stripUrlDetails(input.pathname) } : {}),
    ...(input.screenName ? { screenName: input.screenName } : {}),
    properties: {
      ...properties,
      ...(routeTemplate && input.eventName === "page_viewed" ? { routeTemplate } : {})
    }
  };
}

export function sanitizeProperties(
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

export function stripUrlDetails(pathname: string): string {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "/";
  return path || "/";
}

export function templateWebPath(pathname: string): string {
  const path = stripUrlDetails(pathname);

  return path
    .replace(/\/listings\/[^/]+/u, "/listings/[id]")
    .replace(/\/conversations\/[^/]+/u, "/conversations/[id]")
    .replace(/\/categories\/[^/]+/u, "/categories/[slug]");
}

export function clampEngagementDelta(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return 0;
  }

  return Math.min(Math.round(deltaMs), MAX_HEARTBEAT_DELTA_MS);
}
