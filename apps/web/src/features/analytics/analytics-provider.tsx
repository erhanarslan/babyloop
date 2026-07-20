"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import {
  createWebAnalyticsSession,
  shouldSendWebEngagementHeartbeat,
  shouldStartNewWebAnalyticsSession,
  type WebAnalyticsSessionState
} from "./analytics-session-model";
import { createRandomId, WebAnalyticsClient } from "./analytics-client";
import { AnalyticsContext, type AnalyticsContextValue } from "./use-analytics";
import { AUTH_CHANGED_EVENT, AUTH_SESSION_ENDED_EVENT } from "../../lib/auth-client";
import { useLegalConsent } from "../legal/legal-consent";

const ANONYMOUS_ID_KEY = "babyloop.analytics.anonymousId";
const SESSION_STATE_KEY = "babyloop.analytics.session";
const HEARTBEAT_MS = 15_000;

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { analyticsEnabled } = useLegalConsent();
  const pathname = usePathname() || "/";
  const [sessionState, setSessionState] = useState<WebAnalyticsSessionState | null>(null);
  const clientRef = useRef<WebAnalyticsClient | null>(null);
  const lastPageViewRef = useRef<string | null>(null);
  const lastEngagementAtRef = useRef(Date.now());
  const pathnameRef = useRef(pathname);
  const sessionRef = useRef<WebAnalyticsSessionState | null>(sessionState);

  useEffect(() => {
    if (!analyticsEnabled) {
      clientRef.current = null;
      setSessionState(null);
      lastPageViewRef.current = null;
      window.localStorage.removeItem(ANONYMOUS_ID_KEY);
      window.sessionStorage.removeItem(SESSION_STATE_KEY);
      return;
    }

    const nextSession = loadOrCreateSession();
    setSessionState(nextSession);
    clientRef.current = new WebAnalyticsClient({
      anonymousId: nextSession.anonymousId,
      getSessionId: () => sessionRef.current?.sessionId ?? nextSession.sessionId
    });
  }, [analyticsEnabled]);

  useEffect(() => {
    sessionRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    pathnameRef.current = pathname;

    if (!analyticsEnabled) {
      return;
    }
    const client = clientRef.current;

    if (!client) {
      return;
    }

    const pageKey = `${sessionRef.current?.sessionId ?? "unknown"}:${pathname}`;

    if (lastPageViewRef.current !== pageKey) {
      lastPageViewRef.current = pageKey;
      client.trackPageView(pathname);
      void client.flush();
    }
  }, [analyticsEnabled, pathname]);

  useEffect(() => {
    if (!analyticsEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      const client = clientRef.current;

      if (!client) {
        return;
      }

      const now = Date.now();
      const deltaMs = now - lastEngagementAtRef.current;
      lastEngagementAtRef.current = now;

      if (!shouldSendWebEngagementHeartbeat({
        deltaMs,
        documentVisible: document.visibilityState === "visible",
        windowFocused: document.hasFocus()
      })) {
        return;
      }

      client.trackEngagement(pathnameRef.current, deltaMs);
      void client.flush();
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [analyticsEnabled]);

  useEffect(() => {
    if (!analyticsEnabled) {
      return;
    }

    const flushCurrentRoute = () => {
      const client = clientRef.current;

      if (!client) {
        return;
      }

      const now = Date.now();
      const deltaMs = now - lastEngagementAtRef.current;
      lastEngagementAtRef.current = now;
      client.trackEngagement(pathnameRef.current, deltaMs);
      void client.flush();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushCurrentRoute();
      } else {
        lastEngagementAtRef.current = Date.now();
      }
    };

    const handleAuthEnded = () => {
      const anonymousId = createRandomId();
      const nextSession = createWebAnalyticsSession({
        anonymousId,
        now: Date.now(),
        randomId: createRandomId
      });
      localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
      saveSession(nextSession);
      setSessionState(nextSession);
      clientRef.current = new WebAnalyticsClient({
        anonymousId,
        getSessionId: () => sessionRef.current?.sessionId ?? nextSession.sessionId
      });
      lastPageViewRef.current = null;
    };
    const handlePageHide = () => {
      clientRef.current?.flushBeacon();
    };
    const handleAuthChanged = () => {
      void clientRef.current?.flush();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener(AUTH_SESSION_ENDED_EVENT, handleAuthEnded);
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener(AUTH_SESSION_ENDED_EVENT, handleAuthEnded);
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    };
  }, [analyticsEnabled]);

  const contextValue = useMemo<AnalyticsContextValue>(() => ({
    track: (input) => {
      clientRef.current?.track(input);
      void clientRef.current?.flush();
    },
    trackAiDraftApplied: (input) => {
      clientRef.current?.track({ eventName: "ai_listing_draft_applied", properties: input });
    },
    trackAiDraftRequested: (input) => {
      clientRef.current?.track({ eventName: "ai_listing_draft_requested", properties: input });
    },
    trackAssistantAnswer: (input) => {
      clientRef.current?.track({ eventName: "assistant_answer_received", properties: input });
    },
    trackAssistantOpened: () => {
      clientRef.current?.track({ eventName: "assistant_opened", properties: { sourceSurface: "assistant" } });
    },
    trackCartChanged: (input) => {
      clientRef.current?.track({
        eventName: input.added ? "cart_item_added" : "cart_item_removed",
        properties: input
      });
    },
    trackCheckoutStarted: () => {
      clientRef.current?.track({ eventName: "checkout_started", properties: { sourceSurface: "cart" } });
    },
    trackChildProfileOpened: (input) => {
      clientRef.current?.track({ eventName: "child_profile_opened", properties: input });
    },
    trackConversationOpened: (input) => {
      clientRef.current?.track({ eventName: "conversation_opened", properties: input });
    },
    trackFavoriteChanged: (input) => {
      clientRef.current?.track({
        eventName: input.favorited ? "listing_favorited" : "listing_unfavorited",
        properties: input
      });
    },
    trackListingImpression: (input) => {
      clientRef.current?.track({ eventName: "listing_impression", properties: input });
    },
    trackListingOpened: (input) => {
      clientRef.current?.track({ eventName: "listing_opened", properties: input });
    },
    trackReminderChanged: (input) => {
      clientRef.current?.track({
        eventName: input.action === "created"
          ? "child_reminder_created"
          : input.action === "updated"
            ? "child_reminder_updated"
            : "child_reminder_deleted",
        properties: input
      });
    }
  }), []);

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
}

function loadOrCreateSession(): WebAnalyticsSessionState {
  const now = Date.now();
  const anonymousId = getOrCreateAnonymousId();
  const existing = readSession();

  if (existing && !shouldStartNewWebAnalyticsSession(existing, now)) {
    const continuedSession = {
      ...existing,
      lastSeenAt: now
    };
    saveSession(continuedSession);
    return continuedSession;
  }

  const nextSession = createWebAnalyticsSession({
    anonymousId,
    now,
    randomId: createRandomId
  });
  saveSession(nextSession);
  return nextSession;
}

function getOrCreateAnonymousId(): string {
  const existing = localStorage.getItem(ANONYMOUS_ID_KEY);

  if (existing) {
    return existing;
  }

  const anonymousId = createRandomId();
  localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
  return anonymousId;
}

function readSession(): WebAnalyticsSessionState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STATE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    return isWebAnalyticsSessionState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveSession(session: WebAnalyticsSessionState): void {
  sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(session));
}

function isWebAnalyticsSessionState(value: unknown): value is WebAnalyticsSessionState {
  return typeof value === "object" &&
    value !== null &&
    "anonymousId" in value &&
    "lastSeenAt" in value &&
    "sessionId" in value &&
    typeof value.anonymousId === "string" &&
    typeof value.lastSeenAt === "number" &&
    typeof value.sessionId === "string";
}
