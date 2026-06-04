"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { LoadingBlock } from "../../components/ui";
import { clearAuthToken, getAuthToken, refreshSession } from "../../lib/auth-client";

type AuthCallbackProps = {
  apiBaseUrl: string;
};

export function AuthCallback({ apiBaseUrl }: AuthCallbackProps) {
  const hasHandledCallback = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

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

      const refreshed = await refreshSession(apiBaseUrl);

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
      title="Completing login"
      message="BabyLoop is securely finishing your Google sign-in."
    />
  );
}
