"use client";

import { useSearchParams } from "next/navigation";
import { Alert } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";

export function AuthErrorNotice() {
  const { dictionary } = useI18n();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const passwordChanged = searchParams.get("passwordChanged");

  if (passwordChanged === "1") {
    return (
      <Alert
        tone="info"
        title={dictionary.auth.passwordChangedTitle}
        message={dictionary.auth.passwordChangedBody}
      />
    );
  }

  if (error === "google_auth_failed") {
    return (
      <Alert
        title={dictionary.auth.googleFailedTitle}
        message={dictionary.auth.googleFailedBody}
      />
    );
  }

  if (error === "google_auth_unavailable") {
    return (
      <Alert
        title={dictionary.auth.googleUnavailableTitle}
        message={dictionary.auth.googleUnavailableBody}
      />
    );
  }

  return null;
}
