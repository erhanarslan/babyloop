"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  authFetch,
  getAuthToken,
  logout,
  refreshSession,
  type AuthMe
} from "../lib/auth-client";

type AuthNavProps = {
  apiBaseUrl: string;
};

export function AuthNav({ apiBaseUrl }: AuthNavProps) {
  const [currentAuth, setCurrentAuth] = useState<AuthMe | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentAuth() {
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
  }, [apiBaseUrl]);

  if (!currentAuth) {
    return (
      <>
        <Link href="/login">Login</Link>
        <Link href="/register">Register</Link>
      </>
    );
  }

  return (
    <span className="auth-status">
      <Link href="/my-listings">My Listings</Link>
      <span>{currentAuth.profile.displayName}</span>
      <button
        className="nav-button"
        type="button"
        onClick={() => {
          void logout(apiBaseUrl).finally(() => {
            setCurrentAuth(null);
          });
        }}
      >
        Logout
      </button>
    </span>
  );
}
