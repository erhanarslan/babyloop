import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsEventEnvelope } from "@babyloop/shared";
import { WebAnalyticsClient } from "./analytics-client";
import {
  sendWebAnalyticsBatch,
  sendWebAnalyticsBeacon
} from "./analytics-api";

vi.mock("./analytics-api", () => ({
  sendWebAnalyticsBatch: vi.fn(async () => ({ ok: true })),
  sendWebAnalyticsBeacon: vi.fn(() => true)
}));

describe("web analytics client", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("queues sanitized page views and flushes them in a batch", async () => {
    const client = new WebAnalyticsClient({
      anonymousId: "anon-web",
      getNow: () => new Date("2026-07-17T10:00:00.000Z"),
      getSessionId: () => "session-web",
      randomId: () => "event-web-1"
    });

    client.trackPageView("/listings/30000000-0000-4000-8000-000000000001?token=secret");
    await client.flush();

    expect(sendWebAnalyticsBatch).toHaveBeenCalledTimes(1);
    const batch = vi.mocked(sendWebAnalyticsBatch).mock.calls[0]?.[0] as AnalyticsEventEnvelope[];

    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({
      anonymousId: "anon-web",
      eventName: "page_viewed",
      pagePath: "/listings/30000000-0000-4000-8000-000000000001",
      sessionId: "session-web"
    });
    expect(batch[0]?.properties).toMatchObject({
      pageGroup: "listings",
      routeTemplate: "/listings/[id]"
    });
    expect(JSON.stringify(batch)).not.toContain("token=secret");
  });

  it("does not drop queued events when the analytics endpoint fails", async () => {
    vi.setSystemTime(new Date("2026-07-17T10:00:00.000Z"));
    vi.mocked(sendWebAnalyticsBatch)
      .mockResolvedValueOnce({ ok: false, error: { code: "ANALYTICS_UNAVAILABLE", message: "Analytics unavailable" } })
      .mockResolvedValueOnce({ ok: true, data: { accepted: 1, duplicated: 0, rejected: [] } });

    const client = new WebAnalyticsClient({
      anonymousId: "anon-web",
      getSessionId: () => "session-web",
      randomId: () => "event-web-2"
    });

    client.track({
      eventName: "listing_opened",
      pathname: "/listings/listing-1",
      properties: {
        listingId: "30000000-0000-4000-8000-000000000001",
        sourceSurface: "browse"
      }
    });

    await client.flush();
    await client.flush();

    expect(sendWebAnalyticsBatch).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-07-17T10:00:11.000Z"));
    await client.flush();

    expect(sendWebAnalyticsBatch).toHaveBeenCalledTimes(2);
  });

  it("uses sendBeacon only as a bounded unload fallback", () => {
    const client = new WebAnalyticsClient({
      anonymousId: "anon-web",
      getSessionId: () => "session-web",
      randomId: () => "event-web-3"
    });

    client.trackPageView("/assistant");
    client.flushBeacon();

    expect(sendWebAnalyticsBeacon).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendWebAnalyticsBeacon).mock.calls[0]?.[0]).toHaveLength(1);
  });
});
