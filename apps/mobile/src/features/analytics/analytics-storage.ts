import * as SecureStore from "expo-secure-store";
import type { AnalyticsEventEnvelope } from "@babyloop/shared";

import { MOBILE_ANALYTICS_QUEUE_LIMIT, enqueueMobileAnalyticsEvent } from "./analytics-event-model";

const ANONYMOUS_ID_KEY = "babyloop.analytics.anonymousId";
const SESSION_STATE_KEY = "babyloop.analytics.session";
const QUEUE_KEY = "babyloop.analytics.queue";

export type StoredMobileAnalyticsSession = {
  anonymousId: string;
  lastActiveAt: number;
  sessionId: string;
};

export async function getStoredMobileAnalyticsAnonymousId(): Promise<string | null> {
  return SecureStore.getItemAsync(ANONYMOUS_ID_KEY);
}

export async function setStoredMobileAnalyticsAnonymousId(value: string): Promise<void> {
  await SecureStore.setItemAsync(ANONYMOUS_ID_KEY, value);
}

export async function getStoredMobileAnalyticsSession(): Promise<StoredMobileAnalyticsSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_STATE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredMobileAnalyticsSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setStoredMobileAnalyticsSession(value: StoredMobileAnalyticsSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_STATE_KEY, JSON.stringify(value));
}

export async function getStoredMobileAnalyticsQueue(): Promise<AnalyticsEventEnvelope[]> {
  const raw = await SecureStore.getItemAsync(QUEUE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MOBILE_ANALYTICS_QUEUE_LIMIT) : [];
  } catch {
    return [];
  }
}

export async function setStoredMobileAnalyticsQueue(queue: AnalyticsEventEnvelope[]): Promise<void> {
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue.slice(-MOBILE_ANALYTICS_QUEUE_LIMIT)));
}

export async function appendStoredMobileAnalyticsEvent(event: AnalyticsEventEnvelope): Promise<AnalyticsEventEnvelope[]> {
  const queue = await getStoredMobileAnalyticsQueue();
  const nextQueue = enqueueMobileAnalyticsEvent(queue, event);
  await setStoredMobileAnalyticsQueue(nextQueue);
  return nextQueue;
}

function isStoredMobileAnalyticsSession(value: unknown): value is StoredMobileAnalyticsSession {
  return typeof value === "object" &&
    value !== null &&
    "anonymousId" in value &&
    "lastActiveAt" in value &&
    "sessionId" in value &&
    typeof value.anonymousId === "string" &&
    typeof value.lastActiveAt === "number" &&
    typeof value.sessionId === "string";
}
