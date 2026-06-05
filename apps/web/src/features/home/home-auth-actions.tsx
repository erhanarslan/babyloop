"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT, authFetch, getAuthToken, refreshSession, type AuthMe } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";

type HomeAuthActionsProps = {
  apiBaseUrl: string;
  compact?: boolean;
};

export function HomeAuthActions({ apiBaseUrl, compact = false }: HomeAuthActionsProps) {
  const { dictionary } = useI18n();
  const [currentAuth, setCurrentAuth] = useState<AuthMe | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadAuth() {
      try {
        const token = getAuthToken();
        const auth = token ? await fetchMe(apiBaseUrl) : await refreshMe(apiBaseUrl);

        if (isActive) {
          setCurrentAuth(auth);
          setHasLoaded(true);
        }
      } catch {
        if (isActive) {
          setCurrentAuth(null);
          setHasLoaded(true);
        }
      }
    }

    void loadAuth();
    window.addEventListener(AUTH_CHANGED_EVENT, loadAuth);

    return () => {
      isActive = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, loadAuth);
    };
  }, [apiBaseUrl]);

  if (!hasLoaded) {
    return (
      <div className="hero-actions" aria-label="Loading account actions">
        <Link className="primary-link" href="/browse">{dictionary.common.browseMarketplace}</Link>
      </div>
    );
  }

  if (currentAuth) {
    return (
      <div className={compact ? "hero-actions hero-actions-compact" : "hero-actions"} aria-label="Marketplace actions">
        <Link className="primary-link" href="/browse">{dictionary.home.heroPrimaryLoggedIn}</Link>
        <Link className="secondary-link" href="/sell">{dictionary.home.heroSecondaryLoggedIn}</Link>
        <Link className="secondary-link" href="/my-listings">{dictionary.home.heroThirdLoggedIn}</Link>
      </div>
    );
  }

  return (
    <div className={compact ? "hero-actions hero-actions-compact" : "hero-actions"} aria-label="Account actions">
      <Link className="primary-link" href="/register">{dictionary.home.heroPrimaryLoggedOut}</Link>
      <Link className="secondary-link" href="/login">{dictionary.home.heroSecondaryLoggedOut}</Link>
      <Link className="secondary-link" href="/browse">{dictionary.home.heroThird}</Link>
    </div>
  );
}

async function fetchMe(apiBaseUrl: string): Promise<AuthMe | null> {
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/me");
  const body = (await response.json()) as ApiResponse<AuthMe>;

  return response.ok && body.ok ? body.data : null;
}

async function refreshMe(apiBaseUrl: string): Promise<AuthMe | null> {
  const refreshed = await refreshSession(apiBaseUrl);

  return refreshed.ok ? { profile: refreshed.data.profile, user: refreshed.data.user } : null;
}
