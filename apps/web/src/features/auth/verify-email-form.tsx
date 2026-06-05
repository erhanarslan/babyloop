"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, EmptyState, LoadingBlock } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { confirmEmailVerification } from "./api";

type VerifyEmailFormProps = {
  apiBaseUrl: string;
};

type VerificationState = "loading" | "success" | "failure";

export function VerifyEmailForm({ apiBaseUrl }: VerifyEmailFormProps) {
  const { dictionary } = useI18n();
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
        title={dictionary.auth.verificationMissing}
        message={dictionary.auth.verificationMissingBody}
        actionHref="/auth/verify-email/request"
        actionLabel={dictionary.auth.requestVerification}
      />
    );
  }

  if (state === "loading") {
    return (
      <LoadingBlock
        title={dictionary.auth.verifyingEmail}
        message={dictionary.auth.verifyingEmailBody}
      />
    );
  }

  if (state === "success") {
    return (
      <div className="listing-form">
        <Alert
          tone="info"
          title={dictionary.auth.emailVerified}
          message={dictionary.auth.emailVerifiedBody}
        />
        <Link className="primary-link" href="/login">
          {dictionary.common.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <div className="listing-form">
      <Alert
        title={dictionary.auth.verificationFailed}
        message={dictionary.auth.verificationFailedBody}
      />
      <Link className="primary-link" href="/auth/verify-email/request">
        {dictionary.auth.requestNewVerification}
      </Link>
    </div>
  );
}
