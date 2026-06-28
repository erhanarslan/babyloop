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
      <div className="auth-recovery-form">
        <LoadingBlock
          title={dictionary.auth.verifyingEmail}
          message={dictionary.auth.verifyingEmailBody}
        />
        <div className="auth-security-summary">
          <div>
            <strong>{dictionary.auth.verificationInProgressTitle}</strong>
            <span>{dictionary.auth.verificationInProgressBody}</span>
          </div>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="listing-form auth-recovery-form">
        <Alert
          tone="info"
          title={dictionary.auth.emailVerified}
          message={dictionary.auth.emailVerifiedBody}
        />
        <div className="auth-security-summary">
          <div>
            <strong>{dictionary.auth.verifiedTitle}</strong>
            <span>{dictionary.auth.verifiedBody}</span>
          </div>
        </div>
        <Link className="primary-link" href="/login">
          {dictionary.common.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <div className="listing-form auth-recovery-form">
      <Alert
        title={dictionary.auth.verificationFailed}
        message={dictionary.auth.verificationFailedBody}
      />
      <div className="auth-security-summary">
        <div>
          <strong>{dictionary.auth.expiredVerificationTitle}</strong>
          <span>{dictionary.auth.expiredVerificationBody}</span>
        </div>
      </div>
      <Link className="primary-link" href="/auth/verify-email/request">
        {dictionary.auth.requestNewVerification}
      </Link>
    </div>
  );
}
