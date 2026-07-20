import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { useAuthSession } from "../auth/auth-session";
import { subscribeMobileRealtime } from "../realtime/mobile-realtime";
import { fetchMobileConversations, type MobileConversationSummary } from "./messages-api";
import { mergeRealtimeConversationSummary } from "./messages-realtime-model";

export type MobileConversationListStatus = "idle" | "loading" | "ready" | "error";

type MobileConversationListRefreshOptions = {
  maxAgeMs?: number;
  silent?: boolean;
};

type MobileConversationListContextValue = {
  conversations: MobileConversationSummary[];
  error: string | null;
  refresh: (options?: MobileConversationListRefreshOptions) => Promise<void>;
  status: MobileConversationListStatus;
};

const MobileConversationListContext = createContext<MobileConversationListContextValue | null>(null);
const APP_RESUME_MAX_AGE_MS = 30_000;

export function MobileConversationListProvider({ children }: { children: ReactNode }) {
  const authSession = useAuthSession();
  const currentProfileId = authSession.currentUser?.profile.id ?? null;
  const [conversations, setConversations] = useState<MobileConversationSummary[]>([]);
  const [status, setStatus] = useState<MobileConversationListStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<{ profileId: string; promise: Promise<void> } | null>(null);
  const lastLoadedAtRef = useRef(0);
  const currentProfileIdRef = useRef(currentProfileId);
  currentProfileIdRef.current = currentProfileId;

  const refresh = useCallback(async (options: MobileConversationListRefreshOptions = {}) => {
    if (!currentProfileId) {
      setConversations([]);
      setStatus("ready");
      setError(null);
      lastLoadedAtRef.current = 0;
      return;
    }

    const maxAgeMs = Math.max(0, options.maxAgeMs ?? 0);

    if (maxAgeMs > 0 && Date.now() - lastLoadedAtRef.current < maxAgeMs) {
      return;
    }

    if (inFlightRef.current?.profileId === currentProfileId) {
      return inFlightRef.current.promise;
    }

    const requestProfileId = currentProfileId;
    const task = (async () => {
      if (!options.silent) {
        setStatus("loading");
      }

      try {
        const nextConversations = await fetchMobileConversations();

        if (currentProfileIdRef.current !== requestProfileId) {
          return;
        }

        setConversations(nextConversations);
        setStatus("ready");
        setError(null);
        lastLoadedAtRef.current = Date.now();
      } catch (nextError) {
        if (currentProfileIdRef.current !== requestProfileId) {
          return;
        }

        if (!options.silent) {
          setStatus("error");
          setError(nextError instanceof Error ? nextError.message : "Mesajlar şu an yüklenemedi.");
        }
      }
    })();

    const trackedTask = task.finally(() => {
      if (inFlightRef.current?.promise === trackedTask) {
        inFlightRef.current = null;
      }
    });

    inFlightRef.current = { profileId: requestProfileId, promise: trackedTask };
    return trackedTask;
  }, [currentProfileId]);

  useEffect(() => {
    if (!currentProfileId) {
      setConversations([]);
      setStatus("ready");
      setError(null);
      lastLoadedAtRef.current = 0;
      return;
    }

    void refresh();
  }, [currentProfileId, refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refresh({ maxAgeMs: APP_RESUME_MAX_AGE_MS, silent: true });
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    if (!currentProfileId) {
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;

    void subscribeMobileRealtime({
      onConversationUpdated: (payload) => {
        if (currentProfileIdRef.current !== currentProfileId) {
          return;
        }

        setConversations((currentConversations) =>
          mergeRealtimeConversationSummary(currentConversations, payload.conversation)
        );
        setStatus("ready");
        setError(null);
        lastLoadedAtRef.current = Date.now();
      }
    }).then((subscription) => {
      if (!active) {
        subscription.unsubscribe();
        return;
      }

      unsubscribe = subscription.unsubscribe;
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [currentProfileId]);

  const value = useMemo<MobileConversationListContextValue>(() => ({
    conversations,
    error,
    refresh,
    status
  }), [conversations, error, refresh, status]);

  return (
    <MobileConversationListContext.Provider value={value}>
      {children}
    </MobileConversationListContext.Provider>
  );
}

export function useMobileConversationList(): MobileConversationListContextValue {
  const context = useContext(MobileConversationListContext);

  if (!context) {
    throw new Error("useMobileConversationList must be used inside MobileConversationListProvider.");
  }

  return context;
}
