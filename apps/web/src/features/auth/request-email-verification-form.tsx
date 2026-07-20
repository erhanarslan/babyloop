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
    <form className="email-verification-request-form" onSubmit={handleSubmit}>
      <TextInput
        autoComplete="email"
        inputMode="email"
        label={dictionary.common.email}
        maxLength={320}
        name="email"
        placeholder="ornek@eposta.com"
        required
        type="email"
        wide
      />

      <p className="form-note">{dictionary.auth.requestVerificationDescription}</p>

      {errorMessage ? (
        <Alert title={dictionary.auth.accountFailed} message={errorMessage} />
      ) : null}

      {hasSubmitted ? (
        <Alert
          tone="info"
          title={dictionary.auth.verificationRequestSent}
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

      <div className="email-verification-request-actions">
        <Button className="w-full" type="submit" disabled={isSubmitting}>
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
