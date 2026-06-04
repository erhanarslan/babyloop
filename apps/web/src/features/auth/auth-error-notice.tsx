"use client";

import { useSearchParams } from "next/navigation";
import { Alert } from "../../components/ui";

export function AuthErrorNotice() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (error !== "google_auth_failed") {
    return null;
  }

  return (
    <Alert
      title="Google login failed"
      message="Google authentication could not be completed. Please try again or use email and password."
    />
  );
}
