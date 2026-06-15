"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, EmptyState, TextInput } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { confirmPasswordReset } from "./api";

type ResetPasswordFormProps = {
  apiBaseUrl: string;
};

export function ResetPasswordForm({ apiBaseUrl }: ResetPasswordFormProps) {
  const { dictionary } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasReset, setWasReset] = useState(false);

  if (!token) {
    return (
      <EmptyState
        title={dictionary.auth.tokenMissing}
        message={dictionary.auth.tokenMissingBody}
        actionHref="/forgot-password"
        actionLabel={dictionary.auth.requestResetButton}
      />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const newPassword = getString(formData, "newPassword");
    const confirmPassword = getString(formData, "confirmPassword");

    if (newPassword.length < 8) {
      setErrorMessage(dictionary.auth.passwordTooShort);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(dictionary.auth.passwordsDoNotMatch);
      return;
    }

    setIsSubmitting(true);

    try {
      const body = await confirmPasswordReset(apiBaseUrl, token, newPassword);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setWasReset(true);
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (wasReset) {
    return (
      <div className="listing-form auth-recovery-form">
        <Alert
          tone="info"
          title={dictionary.auth.passwordReset}
          message={dictionary.auth.passwordResetBody}
        />
        <div className="auth-security-summary">
          <div>
            <strong>Next step</strong>
            <span>Sign in with the new password and avoid reusing the old credential elsewhere.</span>
          </div>
        </div>
        <Link className="primary-link" href="/login">
          {dictionary.common.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form className="listing-form auth-recovery-form" onSubmit={handleSubmit}>
      <div className="auth-form-intro">
        <p className="eyebrow">Set new password</p>
        <h2>Choose a unique password</h2>
        <p>
          Use a password you do not use on other sites. Do not paste recovery tokens or credentials into
          BabyLoop messages, listings, or assistant prompts.
        </p>
      </div>

      <div className="form-grid">
        <TextInput
          label={dictionary.auth.newPassword}
          name="newPassword"
          type="password"
          minLength={8}
          maxLength={128}
          required
          wide
        />
        <TextInput
          label={dictionary.auth.confirmNewPassword}
          name="confirmPassword"
          type="password"
          minLength={8}
          maxLength={128}
          required
          wide
        />
      </div>

      <div className="auth-security-summary">
        <div>
          <strong>Single-use token</strong>
          <span>{dictionary.auth.resetSecurityNote}</span>
        </div>
        <div>
          <strong>After reset</strong>
          <span>Return to login and confirm that private account pages open correctly.</span>
        </div>
      </div>

      {errorMessage ? <Alert title={dictionary.auth.accountFailed} message={errorMessage} /> : null}

      <div className="form-actions auth-form-actions">
        <p className="form-note">{dictionary.auth.resetSecurityNote}</p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? dictionary.auth.changing : dictionary.auth.changePassword}
        </Button>
      </div>
    </form>
  );
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
