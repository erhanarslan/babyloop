"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  authFetch,
  getAuthToken,
  logout,
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
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let isActive = true;

    async function loadCurrentAuth() {
      if (pathname === "/auth/callback") {
        return;
      }

      const token = getAuthToken();

      if (!token) {
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

        setCurrentAuth(null);
        return;
      }

      try {
        const response = await authFetch(apiBaseUrl, "/api/v1/auth/me");
        const body = (await response.json()) as ApiResponse<AuthMe>;

        if (!isActive) {
          return;
        }

        if (!response.ok || !body.ok) {
          setCurrentAuth(null);
          return;
        }

        setCurrentAuth(body.data);
      } catch {
        if (isActive) {
          setCurrentAuth(null);
        }
      }
    }

    void loadCurrentAuth();
    window.addEventListener(AUTH_CHANGED_EVENT, loadCurrentAuth);

    return () => {
      isActive = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, loadCurrentAuth);
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
          void logout(apiBaseUrl).finally(() => {
            setCurrentAuth(null);
            router.replace("/");
            router.refresh();
          });
        }}
      >
        {dictionary.common.logout}
      </button>
    </span>
  );
}
