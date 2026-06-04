"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, TextInput } from "../../components/ui";
import { requestPasswordReset } from "./api";

type ForgotPasswordFormProps = {
  apiBaseUrl: string;
};

export function ForgotPasswordForm({ apiBaseUrl }: ForgotPasswordFormProps) {
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDevResetToken(null);
    setErrorMessage(null);

    const email = getString(new FormData(event.currentTarget), "email");

    if (!email) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const body = await requestPasswordReset(apiBaseUrl, email);

      if (!body.ok) {
        setErrorMessage(body.error.message);
        return;
      }

      setHasSubmitted(true);
      setDevResetToken(body.data.devResetToken ?? null);
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
        <Alert title="Password reset request failed" message={errorMessage} />
      ) : null}

      {hasSubmitted ? (
        <Alert
          tone="info"
          title="Request prepared"
          message="If an account exists for this email, password reset instructions have been prepared."
        />
      ) : null}

      {devResetToken ? (
        <div className="dev-token-panel">
          <h2>Development-only reset token</h2>
          <p>
            Real email delivery is not implemented yet. Use this local token to test the reset
            form.
          </p>
          <code>{devResetToken}</code>
        </div>
      ) : null}

      <div className="form-actions">
        <p className="form-note">This response does not reveal whether an account exists.</p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Preparing..." : "Request reset"}
        </Button>
      </div>
    </form>
  );
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
