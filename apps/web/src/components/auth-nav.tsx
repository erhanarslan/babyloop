"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  AUTH_SESSION_ENDED_EVENT,
  fetchCurrentUserWithoutRefresh,
  getAuthToken,
  logoutAndRedirectToHome,
  refreshSession,
  type AuthMe
} from "../lib/auth-client";
import { useI18n } from "../lib/i18n/i18n-provider";

type AuthNavProps = {
  apiBaseUrl: string;
};

export function AuthNav({ apiBaseUrl }: AuthNavProps) {
  const { dictionary } = useI18n();
  const [currentAuth, setCurrentAuth] = useState<AuthMe | null>(null);
  const currentAuthRef = useRef<AuthMe | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    currentAuthRef.current = currentAuth;
  }, [currentAuth]);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentAuth(options: { allowRefresh?: boolean } = {}) {
      const allowRefresh = options.allowRefresh ?? true;
      if (pathname === "/auth/callback") {
        return;
      }

      const token = getAuthToken();

      if (!token) {
        if (!allowRefresh) {
          setCurrentAuth(null);
          return;
        }

        const refreshed = await refreshSession(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (refreshed.ok) {
          setCurrentAuth({
            profile: refreshed.data.profile,
            user: refreshed.data.user
          });
          return;
        }

        if (refreshed.error.code !== "API_UNAVAILABLE") {
          setCurrentAuth(null);
        }
        return;
      }

      try {
        const body = await fetchCurrentUserWithoutRefresh(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          if (body.error.code === "API_UNAVAILABLE") {
            return;
          }

          setCurrentAuth(null);
          return;
        }

        setCurrentAuth(body.data);
      } catch {
        return;
      }
    }

    function loadWithRefresh() {
      void loadCurrentAuth({ allowRefresh: true });
    }

    function checkWithoutRefresh() {
      void loadCurrentAuth({ allowRefresh: false });
    }

    function checkOnFocus() {
      if (getAuthToken() || currentAuthRef.current) {
        checkWithoutRefresh();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkOnFocus();
      }
    }

    function handleSessionEnded() {
      setCurrentAuth(null);
    }

    loadWithRefresh();

    window.addEventListener(AUTH_CHANGED_EVENT, loadWithRefresh);
    window.addEventListener(AUTH_SESSION_ENDED_EVENT, handleSessionEnded);
    window.addEventListener("focus", checkOnFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, loadWithRefresh);
      window.removeEventListener(AUTH_SESSION_ENDED_EVENT, handleSessionEnded);
      window.removeEventListener("focus", checkOnFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [apiBaseUrl, pathname]);

  if (!currentAuth) {
    return (
      <>
        <Link href="/login">{dictionary.common.login}</Link>
        <Link href="/register">{dictionary.common.register}</Link>
      </>
    );
  }

  return (
    <span className="auth-status">
      <Link href="/my-listings">{dictionary.nav.myListings}</Link>
      <Link href="/account/password">{dictionary.nav.changePassword}</Link>
      <span>{currentAuth.profile.displayName}</span>
      <button
        className="nav-button"
        type="button"
        onClick={() => {
          setCurrentAuth(null);
          logoutAndRedirectToHome(apiBaseUrl);
        }}
      >
        {dictionary.common.logout}
      </button>
    </span>
  );
}
