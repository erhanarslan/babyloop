import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuthSession } from "../auth/auth-session";
import { getMobilePushRegistrationCache, setMobilePushRegistrationCache } from "./mobile-push-registration-cache";
import {
  getMobilePushRegistrationRetryDelay,
  isMobilePushRegistrationCacheFresh,
  MOBILE_PUSH_REGISTRATION_MAX_ATTEMPTS,
  shouldStopMobilePushRegistration
} from "./mobile-push-registration-policy";
import {
  registerMobileDeviceForPushNotifications
} from "./mobile-push-registration";

export function MobilePushRegistrationBootstrap() {
  const authSession = useAuthSession();
  const currentProfileId = authSession.currentUser?.profile.id ?? null;
  const canRegisterPush = authSession.status === "authenticated" && Boolean(currentProfileId);

  const attemptCountRef = useRef(0);
  const cacheCheckedRef = useRef(false);
  const inFlightRef = useRef(false);
  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    logMobilePushBootstrapDebug("bootstrap state", {
      authStatus: authSession.status,
      hasCurrentUser: Boolean(authSession.currentUser),
      canRegisterPush
    });
  }, [authSession.status, authSession.currentUser, canRegisterPush]);

  useEffect(() => {
    if (!canRegisterPush || !currentProfileId) {
      logMobilePushBootstrapDebug("skip registration until authenticated", {
        authStatus: authSession.status,
        hasCurrentUser: Boolean(authSession.currentUser)
      });
      return;
    }

    const authenticatedProfileId = currentProfileId;

    stoppedRef.current = false;
    attemptCountRef.current = 0;
    cacheCheckedRef.current = false;

    function clearRetryTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function scheduleRetry() {
      if (
        stoppedRef.current ||
        attemptCountRef.current >= MOBILE_PUSH_REGISTRATION_MAX_ATTEMPTS ||
        timerRef.current
      ) {
        return;
      }

      const delayMs = getMobilePushRegistrationRetryDelay(attemptCountRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runRegistration();
      }, delayMs);
    }

    async function hasFreshRegistrationCache(): Promise<boolean> {
      if (cacheCheckedRef.current) {
        return false;
      }

      cacheCheckedRef.current = true;
      const cached = await getMobilePushRegistrationCache();

      return Boolean(cached && isMobilePushRegistrationCacheFresh({
        cachedProfileId: cached.profileId,
        currentProfileId: authenticatedProfileId,
        now: Date.now(),
        registeredAt: cached.registeredAt
      }));
    }

    async function runRegistration() {
      if (
        stoppedRef.current ||
        inFlightRef.current ||
        timerRef.current ||
        attemptCountRef.current >= MOBILE_PUSH_REGISTRATION_MAX_ATTEMPTS
      ) {
        return;
      }

      inFlightRef.current = true;

      try {
        if (await hasFreshRegistrationCache()) {
          stoppedRef.current = true;
          clearRetryTimer();
          logMobilePushBootstrapDebug("registration cache hit", {
            profileId: authenticatedProfileId
          });
          return;
        }

        attemptCountRef.current += 1;
        logMobilePushBootstrapDebug("registration attempt", {
          attempt: attemptCountRef.current
        });

        const result = await registerMobileDeviceForPushNotifications();
        logMobilePushBootstrapDebug("registration result", result);

        if (result.status === "registered") {
          await setMobilePushRegistrationCache({
            profileId: authenticatedProfileId,
            registeredAt: Date.now(),
            ...(result.tokenHashPrefix ? { tokenHashPrefix: result.tokenHashPrefix } : {})
          }).catch(() => undefined);
        }

        if (shouldStopMobilePushRegistration(result)) {
          stoppedRef.current = true;
          clearRetryTimer();
          return;
        }

        scheduleRetry();
      } catch {
        scheduleRetry();
      } finally {
        inFlightRef.current = false;
      }
    }

    void runRegistration();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void runRegistration();
      }
    });

    return () => {
      stoppedRef.current = true;
      clearRetryTimer();
      subscription.remove();
    };
  }, [authSession.currentUser, authSession.status, canRegisterPush, currentProfileId]);

  return null;
}

function logMobilePushBootstrapDebug(message: string, metadata?: Record<string, unknown>): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info(`[BabyLoop push] ${message}`, metadata ?? {});
  }
}
