"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoadingBlock } from "../../components/ui";
import { clearAuthToken, getAuthToken, refreshSession } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";

type AuthCallbackProps = {
  apiBaseUrl: string;
};

export function AuthCallback({ apiBaseUrl }: AuthCallbackProps) {
  const { dictionary } = useI18n();
  const hasHandledCallback = useRef(false);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (hasHandledCallback.current) {
      return;
    }

    hasHandledCallback.current = true;

    async function completeGoogleLogin() {
      if (status !== "success") {
        clearAuthToken();
        router.replace("/login?error=google_auth_failed");
        return;
      }

      const refreshed = await refreshSession(apiBaseUrl, { force: true });

      if (!refreshed.ok) {
        if (getAuthToken()) {
          router.replace("/");
          router.refresh();
          return;
        }

        clearAuthToken();
        router.replace("/login?error=google_auth_failed");
        return;
      }

      router.replace("/");
      router.refresh();
    }

    void completeGoogleLogin();
  }, [apiBaseUrl, router, status]);

  return (
  <LoadingBlock
    title={isMounted ? dictionary.auth.callbackTitle : "Signing you in"}
    message={
      isMounted
        ? dictionary.auth.callbackDescription
        : "Finalizing your BabyLoop session."
    }
  />
);
}
