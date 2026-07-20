import type { AnalyticsEventEnvelope } from "@babyloop/shared";
import { MobileAnalyticsClient } from "./analytics-client";
import { sendMobileAnalyticsBatch } from "./analytics-api";
import {
  getStoredMobileAnalyticsQueue,
  setStoredMobileAnalyticsQueue
} from "./analytics-storage";

const mockSecureStore = new Map<string, string>();

jest.mock("expo-constants", () => ({
  expoConfig: {
    version: "1.2.3"
  },
  nativeAppVersion: "1.2.3"
}));

jest.mock("react-native", () => ({
  Platform: {
    OS: "ios"
  }
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  })
}));

jest.mock("./analytics-api", () => ({
  sendMobileAnalyticsBatch: jest.fn(async () => ({ ok: true }))
}));

describe("mobile analytics client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureStore.clear();
  });

  it("stores screen events in the offline queue and flushes FIFO", async () => {
    const client = new MobileAnalyticsClient({
      anonymousId: "anon-mobile",
      getScreenName: () => "discover",
      getSessionId: () => "session-mobile",
      randomId: () => "event-mobile-1"
    });

    await client.trackScreenView("listing_detail");

    const queued = await getStoredMobileAnalyticsQueue();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      anonymousId: "anon-mobile",
      appVersion: "1.2.3",
      eventName: "screen_viewed",
      screenName: "listing_detail",
      sessionId: "session-mobile"
    });

    await client.flush();

    expect(sendMobileAnalyticsBatch).toHaveBeenCalledTimes(1);
    expect((sendMobileAnalyticsBatch as jest.Mock).mock.calls[0][0]).toHaveLength(1);
    expect(await getStoredMobileAnalyticsQueue()).toHaveLength(0);
  });

  it("keeps queued events when sending fails", async () => {
    (sendMobileAnalyticsBatch as jest.Mock).mockResolvedValueOnce({ ok: false });

    const firstEvent = buildQueuedEvent("event-mobile-2");
    await setStoredMobileAnalyticsQueue([firstEvent]);

    const client = new MobileAnalyticsClient({
      anonymousId: "anon-mobile",
      getScreenName: () => "discover",
      getSessionId: () => "session-mobile",
      randomId: () => "event-mobile-3"
    });

    await client.flush();

    expect(sendMobileAnalyticsBatch).toHaveBeenCalledTimes(1);
    expect(await getStoredMobileAnalyticsQueue()).toHaveLength(1);
  });
  it("serializes concurrent queue writes without dropping events", async () => {
    let eventIndex = 0;
    const client = new MobileAnalyticsClient({
      anonymousId: "anon-mobile",
      getScreenName: () => "discover",
      getSessionId: () => "session-mobile",
      randomId: () => `event-concurrent-${eventIndex += 1}`
    });

    await Promise.all(Array.from({ length: 20 }, () => client.trackScreenView("discover")));

    const queued = await getStoredMobileAnalyticsQueue();
    expect(queued).toHaveLength(20);
    expect(new Set(queued.map((event) => event.eventId)).size).toBe(20);
  });

  it("flushes all stored batches in FIFO order", async () => {
    await setStoredMobileAnalyticsQueue(
      Array.from({ length: 55 }, (_, index) => buildQueuedEvent(`event-batch-${index}`))
    );
    const client = new MobileAnalyticsClient({
      anonymousId: "anon-mobile",
      getScreenName: () => "discover",
      getSessionId: () => "session-mobile"
    });

    await client.flush();

    expect(sendMobileAnalyticsBatch).toHaveBeenCalledTimes(2);
    expect((sendMobileAnalyticsBatch as jest.Mock).mock.calls[0][0]).toHaveLength(50);
    expect((sendMobileAnalyticsBatch as jest.Mock).mock.calls[1][0]).toHaveLength(5);
    expect(await getStoredMobileAnalyticsQueue()).toHaveLength(0);
  });

});

function buildQueuedEvent(eventId: string): AnalyticsEventEnvelope {
  return {
    anonymousId: "anon-mobile",
    eventId,
    eventName: "screen_viewed",
    eventVersion: 1,
    occurredAt: "2026-07-17T10:00:00.000Z",
    platform: "mobile",
    screenName: "discover",
    sessionId: "session-mobile",
    properties: {
      screenName: "discover"
    }
  };
}
