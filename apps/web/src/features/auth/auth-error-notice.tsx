"use client";

import { useSearchParams } from "next/navigation";
import { Alert } from "../../components/ui";

export function AuthErrorNotice() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const passwordChanged = searchParams.get("passwordChanged");

  if (passwordChanged === "1") {
    return (
      <Alert
        tone="info"
        title="Password changed"
        message="Your password was changed. Please login again with your new password."
      />
    );
  }

  if (error === "google_auth_failed") {
    return (
      <Alert
        title="Google login failed"
        message="Google authentication could not be completed. Please try again or use email and password."
      />
    );
  }

  if (error === "google_auth_unavailable") {
    return (
      <Alert
        title="Google sign-in unavailable"
        message="Google sign-in is not configured in this environment. Please use email and password."
      />
    );
  }

  return null;
}
