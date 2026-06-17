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
  redirectTo?: string | null;
};

export function useProtectedRoute({
  apiBaseUrl,
  onUnauthenticated,
  redirectTo = "/"
}: UseProtectedRouteOptions) {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleUnauthenticated = useCallback(() => {
    setIsAuthenticated(false);
    setIsCheckingAuth(false);
    onUnauthenticated?.();

    if (redirectTo) {
      router.replace(redirectTo);
    }
  }, [onUnauthenticated, redirectTo, router]);

  const requireAuth = useCallback(async () => {
    const token = await getOrRefreshAuthToken(apiBaseUrl);

    if (!token) {
      handleUnauthenticated();
      return false;
    }

    setIsAuthenticated(true);
    setIsCheckingAuth(false);
    return true;
  }, [apiBaseUrl, handleUnauthenticated]);

  useEffect(() => {
    let isActive = true;

    async function checkAuth() {
      const token = await getOrRefreshAuthToken(apiBaseUrl);

      if (!isActive) {
        return;
      }

      if (!token) {
        handleUnauthenticated();
        return;
      }

      setIsAuthenticated(true);
      setIsCheckingAuth(false);
    }

    function handleAuthChange() {
      if (!getAuthToken()) {
        handleUnauthenticated();
        return;
      }

      setIsAuthenticated(true);
      setIsCheckingAuth(false);
    }

    void checkAuth();
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);

    return () => {
      isActive = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    };
  }, [apiBaseUrl, handleUnauthenticated]);

  return {
    isCheckingAuth,
    isAuthenticated,
    requireAuth
  };
}
