"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, EmptyState, LoadingBlock } from "../../components/ui";
import { confirmEmailVerification } from "./api";

type VerifyEmailFormProps = {
  apiBaseUrl: string;
};

type VerificationState = "loading" | "success" | "failure";

export function VerifyEmailForm({ apiBaseUrl }: VerifyEmailFormProps) {
  const hasSubmitted = useRef(false);
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [state, setState] = useState<VerificationState>("loading");

  useEffect(() => {
    if (!token || hasSubmitted.current) {
      return;
    }

    hasSubmitted.current = true;

    async function verifyEmail() {
      try {
        const response = await confirmEmailVerification(apiBaseUrl, token);
        setState(response.ok ? "success" : "failure");
      } catch {
        setState("failure");
      }
    }

    void verifyEmail();
  }, [apiBaseUrl, token]);

  if (!token) {
    return (
      <EmptyState
        title="Verification token missing"
        message="Open the verification link generated for your account."
        actionHref="/auth/verify-email/request"
        actionLabel="Request verification"
      />
    );
  }

  if (state === "loading") {
    return (
      <LoadingBlock
        title="Verifying email"
        message="BabyLoop is checking your verification token."
      />
    );
  }

  if (state === "success") {
    return (
      <div className="listing-form">
        <Alert
          tone="info"
          title="Email verified"
          message="Email verified successfully."
        />
        <Link className="primary-link" href="/login">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="listing-form">
      <Alert
        title="Verification failed"
        message="Verification link is invalid or expired."
      />
      <Link className="primary-link" href="/auth/verify-email/request">
        Request a new verification link
      </Link>
    </div>
  );
}
