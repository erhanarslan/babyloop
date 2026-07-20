import { usePathname } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import {
  createMobileRandomId,
  MobileAnalyticsClient,
  type MobileAnalyticsTrackInput
} from "./analytics-client";
import {
  createMobileAnalyticsSession,
  shouldCountMobileEngagement,
  shouldStartNewMobileAnalyticsSession,
  type MobileAnalyticsSessionState
} from "./analytics-session-model";
import {
  getStoredMobileAnalyticsAnonymousId,
  getStoredMobileAnalyticsSession,
  setStoredMobileAnalyticsAnonymousId,
  setStoredMobileAnalyticsSession
} from "./analytics-storage";
import { MobileAnalyticsContext, type MobileAnalyticsContextValue } from "./use-mobile-analytics";

const HEARTBEAT_MS = 30_000;
export const MOBILE_ANALYTICS_FLUSH_DELAY_MS = 10_000;
export const MOBILE_ANALYTICS_FLUSH_THRESHOLD = 10;

export function MobileAnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const screenName = getScreenNameFromPathname(pathname);
  const [sessionState, setSessionState] = useState<MobileAnalyticsSessionState | null>(null);
  const clientRef = useRef<MobileAnalyticsClient | null>(null);
  const screenNameRef = useRef(screenName);
  const lastScreenViewRef = useRef<string | null>(null);
  const lastEngagementAtRef = useRef(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const sessionRef = useRef<MobileAnalyticsSessionState | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduledFlush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const flushNow = useCallback(() => {
    clearScheduledFlush();
    void clientRef.current?.flush();
  }, [clearScheduledFlush]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) {
      return;
    }

    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      void clientRef.current?.flush();
    }, MOBILE_ANALYTICS_FLUSH_DELAY_MS);
  }, []);

  const trackQueued = useCallback((input: MobileAnalyticsTrackInput) => {
    void queueMobileAnalyticsEvent(clientRef.current, input, { flushNow, scheduleFlush });
  }, [flushNow, scheduleFlush]);

  useEffect(() => {
    let active = true;

    void loadOrCreateMobileSession().then((session) => {
      if (!active) {
        return;
      }

      sessionRef.current = session;
      setSessionState(session);
      clientRef.current = new MobileAnalyticsClient({
        anonymousId: session.anonymousId,
        getScreenName: () => screenNameRef.current,
        getSessionId: () => sessionRef.current?.sessionId ?? session.sessionId
      });
      void clientRef.current.flush();
    });

    return () => {
      active = false;
      clearScheduledFlush();
      void clientRef.current?.flush();
    };
  }, [clearScheduledFlush]);

  useEffect(() => {
    sessionRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    screenNameRef.current = screenName;
    const client = clientRef.current;

    if (!client || !sessionRef.current) {
      return;
    }

    const key = `${sessionRef.current.sessionId}:${screenName}`;

    if (lastScreenViewRef.current === key) {
      return;
    }

    lastScreenViewRef.current = key;
    void client.trackScreenView(screenName).then((queueLength) => {
      if (queueLength >= MOBILE_ANALYTICS_FLUSH_THRESHOLD) {
        flushNow();
      } else {
        scheduleFlush();
      }
    });
  }, [flushNow, scheduleFlush, screenName, sessionState]);

  useEffect(() => {
    const interval = setInterval(() => {
      const client = clientRef.current;

      if (!client || !shouldCountMobileEngagement(toMobileState(appStateRef.current))) {
        return;
      }

      const now = Date.now();
      const deltaMs = now - lastEngagementAtRef.current;
      lastEngagementAtRef.current = now;
      void client.trackEngagement(screenNameRef.current, deltaMs).then((queueLength) => {
        if (queueLength >= MOBILE_ANALYTICS_FLUSH_THRESHOLD) {
          flushNow();
        } else if (queueLength > 0) {
          scheduleFlush();
        }
      });
    }, HEARTBEAT_MS);

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState === "active" && nextState !== "active") {
        const now = Date.now();
        const deltaMs = now - lastEngagementAtRef.current;
        lastEngagementAtRef.current = now;
        clearScheduledFlush();
        void trackEngagementAndFlush(clientRef.current, screenNameRef.current, deltaMs);
        return;
      }

      if (nextState === "active") {
        lastEngagementAtRef.current = Date.now();
        void resumeMobileSession().then((session) => {
          sessionRef.current = session;
          setSessionState(session);
          flushNow();
        });
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [clearScheduledFlush, flushNow, scheduleFlush]);

  const contextValue = useMemo<MobileAnalyticsContextValue>(() => ({
    track: trackQueued,
    trackAiDraftApplied: (input) => {
      trackQueued({ eventName: "ai_listing_draft_applied", properties: input });
    },
    trackAiDraftRequested: (input) => {
      trackQueued({ eventName: "ai_listing_draft_requested", properties: input });
    },
    trackAssistantAnswer: (input) => {
      trackQueued({ eventName: "assistant_answer_received", properties: input });
    },
    trackAssistantOpened: () => {
      trackQueued({ eventName: "assistant_opened", properties: { sourceSurface: "assistant" } });
    },
    trackCartChanged: (input) => {
      trackQueued({
        eventName: input.added ? "cart_item_added" : "cart_item_removed",
        properties: input
      });
    },
    trackChildProfileOpened: (input) => {
      trackQueued({ eventName: "child_profile_opened", properties: input });
    },
    trackConversationOpened: (input) => {
      trackQueued({ eventName: "conversation_opened", properties: input });
    },
    trackFavoriteChanged: (input) => {
      trackQueued({
        eventName: input.favorited ? "listing_favorited" : "listing_unfavorited",
        properties: input
      });
    },
    trackListingOpened: (input) => {
      trackQueued({ eventName: "listing_opened", properties: input });
    },
    trackReminderChanged: (input) => {
      trackQueued({
        eventName: input.action === "created"
          ? "child_reminder_created"
          : input.action === "updated"
            ? "child_reminder_updated"
            : "child_reminder_deleted",
        properties: input
      });
    }
  }), [trackQueued]);

  return (
    <MobileAnalyticsContext.Provider value={contextValue}>
      {children}
    </MobileAnalyticsContext.Provider>
  );
}

async function queueMobileAnalyticsEvent(
  client: MobileAnalyticsClient | null,
  input: MobileAnalyticsTrackInput,
  controls: { flushNow: () => void; scheduleFlush: () => void }
): Promise<void> {
  if (!client) {
    return;
  }

  const queueLength = await client.track(input);

  if (queueLength >= MOBILE_ANALYTICS_FLUSH_THRESHOLD) {
    controls.flushNow();
  } else {
    controls.scheduleFlush();
  }
}

async function trackEngagementAndFlush(
  client: MobileAnalyticsClient | null,
  screenName: string,
  deltaMs: number
): Promise<void> {
  if (!client) {
    return;
  }

  await client.trackEngagement(screenName, deltaMs);
  await client.flush();
}

async function loadOrCreateMobileSession(): Promise<MobileAnalyticsSessionState> {
  const now = Date.now();
  const anonymousId = await getOrCreateMobileAnonymousId();
  const existing = await getStoredMobileAnalyticsSession();

  if (existing && !shouldStartNewMobileAnalyticsSession(existing, now)) {
    const continued = {
      ...existing,
      lastActiveAt: now
    };
    await setStoredMobileAnalyticsSession(continued);
    return continued;
  }

  const nextSession = createMobileAnalyticsSession({
    anonymousId,
    now,
    randomId: createMobileRandomId
  });
  await setStoredMobileAnalyticsSession(nextSession);
  return nextSession;
}

async function resumeMobileSession(): Promise<MobileAnalyticsSessionState> {
  return loadOrCreateMobileSession();
}

async function getOrCreateMobileAnonymousId(): Promise<string> {
  const existing = await getStoredMobileAnalyticsAnonymousId();

  if (existing) {
    return existing;
  }

  const anonymousId = createMobileRandomId();
  await setStoredMobileAnalyticsAnonymousId(anonymousId);
  return anonymousId;
}

function toMobileState(state: AppStateStatus): "active" | "background" | "inactive" {
  return state === "active" || state === "background" ? state : "inactive";
}

export function getScreenNameFromPathname(pathname: string): string {
  if (pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/") {
    return "discover";
  }

  if (pathname.includes("favorites")) {
    return "favorites";
  }
  if (pathname.includes("sell")) {
    return "sell";
  }
  if (pathname.includes("basket") || pathname.includes("cart")) {
    return "basket";
  }
  if (pathname.includes("messages")) {
    return "messages";
  }
  if (pathname.includes("conversation")) {
    return "conversation_detail";
  }
  if (pathname.includes("assistant")) {
    return "assistant";
  }
  if (pathname.includes("child")) {
    return "child_profiles";
  }
  if (pathname.includes("notifications")) {
    return "notifications";
  }
  if (pathname.includes("security")) {
    return "security";
  }
  if (pathname.includes("account")) {
    return "account";
  }
  if (pathname.includes("listing")) {
    return "listing_detail";
  }

  return "browse";
}
