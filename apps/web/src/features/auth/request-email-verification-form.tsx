"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, TextInput } from "../../components/ui";
import { requestEmailVerification } from "./api";

type RequestEmailVerificationFormProps = {
  apiBaseUrl: string;
};

export function RequestEmailVerificationForm({ apiBaseUrl }: RequestEmailVerificationFormProps) {
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
      setErrorMessage("Please enter your email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await requestEmailVerification(apiBaseUrl, email);

      if (!response.ok) {
        setErrorMessage(response.error.message);
        return;
      }

      setHasSubmitted(true);
      setDevEmailVerificationToken(response.data.devEmailVerificationToken ?? null);
    } catch {
      setErrorMessage("BabyLoop API is unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="listing-form" onSubmit={handleSubmit}>
      <TextInput label="Email" name="email" type="email" maxLength={320} required wide />

      {errorMessage ? (
        <Alert title="Verification request failed" message={errorMessage} />
      ) : null}

      {hasSubmitted ? (
        <Alert
          tone="info"
          title="Request prepared"
          message="If an account exists and needs verification, a verification email will be sent when email delivery is configured."
        />
      ) : null}

      {devEmailVerificationToken ? (
        <div className="dev-token-panel">
          <h2>Development-only email verification link</h2>
          <p>Real email delivery is not implemented yet. Use this local link to test verification.</p>
          <Link href={`/auth/verify-email?token=${encodeURIComponent(devEmailVerificationToken)}`}>
            Verify email locally
          </Link>
        </div>
      ) : null}

      <div className="form-actions">
        <p className="form-note">This response does not reveal whether an account exists.</p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Preparing..." : "Request verification"}
        </Button>
      </div>
    </form>
  );
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
