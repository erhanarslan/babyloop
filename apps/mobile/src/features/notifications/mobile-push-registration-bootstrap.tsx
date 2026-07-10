import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuthSession } from "../auth/auth-session";
import {
  registerMobileDeviceForPushNotifications,
  type MobilePushRegistrationResult
} from "./mobile-push-registration";

const RETRY_DELAY_MS = 5000;
const MAX_ATTEMPTS = 24;

export function MobilePushRegistrationBootstrap() {
  const authSession = useAuthSession();
  const canRegisterPush =
    authSession.status === "authenticated" && Boolean(authSession.currentUser);

  const attemptCountRef = useRef(0);
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
    if (!canRegisterPush) {
      logMobilePushBootstrapDebug("skip registration until authenticated", {
        authStatus: authSession.status,
        hasCurrentUser: Boolean(authSession.currentUser)
      });
      return;
    }

    stoppedRef.current = false;
    attemptCountRef.current = 0;

    function clearRetryTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function shouldStop(result: MobilePushRegistrationResult): boolean {
      if (result.status === "registered" || result.status === "denied") {
        return true;
      }

      return (
        result.reason === "physical_device_required" ||
        result.reason === "web_not_supported" ||
        result.reason === "android_fcm_configuration_missing"
      );
    }

    function scheduleRetry() {
      if (stoppedRef.current || attemptCountRef.current >= MAX_ATTEMPTS || timerRef.current) {
        return;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runRegistration();
      }, RETRY_DELAY_MS);
    }

    async function runRegistration() {
      if (stoppedRef.current || inFlightRef.current || attemptCountRef.current >= MAX_ATTEMPTS) {
        return;
      }

      inFlightRef.current = true;
      attemptCountRef.current += 1;

      try {
        logMobilePushBootstrapDebug("registration attempt", {
          attempt: attemptCountRef.current
        });

        const result = await registerMobileDeviceForPushNotifications();

        logMobilePushBootstrapDebug("registration result", result);

        if (shouldStop(result)) {
          stoppedRef.current = true;
          clearRetryTimer();
          return;
        }

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
  }, [canRegisterPush]);

  return null;
}


function logMobilePushBootstrapDebug(message: string, metadata?: Record<string, unknown>): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info(`[BabyLoop push] ${message}`, metadata ?? {});
  }
}
