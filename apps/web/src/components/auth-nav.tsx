"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  clearAuthToken,
  getAuthToken,
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
        setCurrentAuth(null);
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
          headers: {
            authorization: `Bearer ${token}`
          }
        });
        const body = (await response.json()) as ApiResponse<AuthMe>;

        if (!isActive) {
          return;
        }

        if (!response.ok || !body.ok) {
          clearAuthToken();
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
      <span>{currentAuth.profile.displayName}</span>
      <button
        className="nav-button"
        type="button"
        onClick={() => {
          clearAuthToken();
        }}
      >
        Logout
      </button>
    </span>
  );
}
