"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, TextInput } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { requestEmailVerification } from "./api";

type RequestEmailVerificationFormProps = {
  apiBaseUrl: string;
};

export function RequestEmailVerificationForm({ apiBaseUrl }: RequestEmailVerificationFormProps) {
  const { dictionary } = useI18n();
  const [devEmailVerificationToken, setDevEmailVerificationToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDevEmailVerificationToken(null);
    setErrorMessage(null);

    const email = getString(new FormData(event.currentTarget), "email");

    if (!email) {
      setErrorMessage(dictionary.auth.requiredFields);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await requestEmailVerification(apiBaseUrl, email);

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error, dictionary));
        return;
      }

      setHasSubmitted(true);
      setDevEmailVerificationToken(response.data.devEmailVerificationToken ?? null);
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="listing-form auth-recovery-form" onSubmit={handleSubmit}>
      <div className="auth-form-intro">
        <p className="eyebrow">Email verification</p>
        <h2>Request a fresh verification link</h2>
        <p>
          Verification helps keep account-only actions clearer. Use only official BabyLoop verification links
          and never forward verification tokens to another person.
        </p>
      </div>

      <TextInput label={dictionary.common.email} name="email" type="email" maxLength={320} required wide />

      {errorMessage ? (
        <Alert title={dictionary.auth.accountFailed} message={errorMessage} />
      ) : null}

      {hasSubmitted ? (
        <Alert
          tone="info"
          title={dictionary.auth.resetPrepared}
          message={dictionary.auth.verificationRequestGeneric}
        />
      ) : null}

      {devEmailVerificationToken ? (
        <div className="dev-token-panel auth-dev-panel">
          <h2>{dictionary.auth.emailVerificationDevTitle}</h2>
          <p>{dictionary.auth.emailDevLink}</p>
          <Link href={`/auth/verify-email?token=${encodeURIComponent(devEmailVerificationToken)}`}>
            {dictionary.auth.verifyLocally}
          </Link>
        </div>
      ) : null}

      <div className="form-actions auth-form-actions">
        <p className="form-note">{dictionary.auth.resetNoReveal}</p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? dictionary.auth.preparing : dictionary.auth.requestVerification}
        </Button>
      </div>
    </form>
  );
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
