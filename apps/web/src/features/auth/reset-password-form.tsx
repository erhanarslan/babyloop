"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
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
  const submitInFlightRef = useRef(false);

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
    if (submitInFlightRef.current) return;
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

    submitInFlightRef.current = true;
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
      submitInFlightRef.current = false;
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
            <strong>{dictionary.auth.resetNextStepTitle}</strong>
            <span>{dictionary.auth.resetNextStepBody}</span>
          </div>
        </div>
        <Link className="primary-link" href="/login">
          {dictionary.common.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form aria-busy={isSubmitting} className="listing-form auth-recovery-form" onSubmit={handleSubmit}>
      <div className="auth-form-intro">
        <p className="eyebrow">{dictionary.auth.resetFormEyebrow}</p>
        <h2>{dictionary.auth.resetFormTitle}</h2>
        <p>{dictionary.auth.resetFormDescription}</p>
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
          <strong>{dictionary.auth.singleUseTokenTitle}</strong>
          <span>{dictionary.auth.resetSecurityNote}</span>
        </div>
        <div>
          <strong>{dictionary.auth.afterResetTitle}</strong>
          <span>{dictionary.auth.resetAfterSubmitBody}</span>
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
