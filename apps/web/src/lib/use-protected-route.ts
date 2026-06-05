"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  getAuthToken,
  getOrRefreshAuthToken
} from "./auth-client";

type UseProtectedRouteOptions = {
  apiBaseUrl: string;
  onUnauthenticated?: () => void;
};

export function useProtectedRoute({
  apiBaseUrl,
  onUnauthenticated
}: UseProtectedRouteOptions) {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const redirectHome = useCallback(() => {
  setIsCheckingAuth(true);
  onUnauthenticated?.();
  router.replace("/");
}, [onUnauthenticated, router]);

  const requireAuth = useCallback(async () => {
    const token = await getOrRefreshAuthToken(apiBaseUrl);

    if (!token) {
      redirectHome();
      return false;
    }

    setIsCheckingAuth(false);
    return true;
  }, [apiBaseUrl, redirectHome]);

  useEffect(() => {
    let isActive = true;

    async function checkAuth() {
      const token = await getOrRefreshAuthToken(apiBaseUrl);

      if (!isActive) {
        return;
      }

      if (!token) {
        redirectHome();
        return;
      }

      setIsCheckingAuth(false);
    }

    function handleAuthChange() {
      if (!getAuthToken()) {
        redirectHome();
      }
    }

    void checkAuth();
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);

    return () => {
      isActive = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    };
  }, [apiBaseUrl, redirectHome]);

  return {
    isCheckingAuth,
    requireAuth
  };
}
