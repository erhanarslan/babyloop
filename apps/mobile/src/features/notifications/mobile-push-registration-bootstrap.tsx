import { useEffect, useRef } from "react";

import { useAuthSession } from "../auth/auth-session";
import { registerMobileDeviceForPushNotifications } from "./mobile-push-registration";

export function MobilePushRegistrationBootstrap() {
  const authSession = useAuthSession();
  const attemptedProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    const profileId = authSession.currentUser?.profile.id ?? null;

    if (!profileId) {
      attemptedProfileIdRef.current = null;
      return;
    }

    if (attemptedProfileIdRef.current === profileId) {
      return;
    }

    attemptedProfileIdRef.current = profileId;

    void registerMobileDeviceForPushNotifications();
  }, [authSession.currentUser?.profile.id]);

  return null;
}
