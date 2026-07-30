"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { Alert, Button, TextInput } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { requestPasswordReset } from "./api";

type ForgotPasswordFormProps = {
  apiBaseUrl: string;
};

export function ForgotPasswordForm({ apiBaseUrl }: ForgotPasswordFormProps) {
  const { dictionary } = useI18n();
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const submitInFlightRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    setDevResetToken(null);
    setErrorMessage(null);

    const email = getString(new FormData(event.currentTarget), "email");

    if (!email) {
      setErrorMessage(dictionary.auth.requiredFields);
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const body = await requestPasswordReset(apiBaseUrl, email);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setHasSubmitted(true);
      setDevResetToken(body.data.devResetToken ?? null);
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form aria-busy={isSubmitting} className="listing-form auth-recovery-form" onSubmit={handleSubmit}>
      <div className="auth-form-intro">
        <p className="eyebrow">{dictionary.auth.forgotFormEyebrow}</p>
        <h2>{dictionary.auth.forgotFormTitle}</h2>
        <p>{dictionary.auth.forgotFormDescription}</p>
      </div>

      <TextInput label={dictionary.common.email} name="email" type="email" maxLength={320} required wide />

      <div className="auth-security-summary" aria-label={dictionary.auth.forgotFormEyebrow}>
        <div>
          <strong>{dictionary.auth.recoveryLinksTitle}</strong>
          <span>{dictionary.auth.recoveryLinksBody}</span>
        </div>
        <div>
          <strong>{dictionary.auth.afterResetTitle}</strong>
          <span>{dictionary.auth.afterResetBody}</span>
        </div>
      </div>

      {errorMessage ? (
        <Alert title={dictionary.auth.accountFailed} message={errorMessage} />
      ) : null}

      {hasSubmitted ? (
        <Alert
          tone="info"
          title={dictionary.auth.resetPrepared}
          message={dictionary.auth.resetGeneric}
        />
      ) : null}

      {devResetToken ? (
        <div className="dev-token-panel auth-dev-panel">
          <h2>{dictionary.auth.resetDevTitle}</h2>
          <p>{dictionary.auth.resetDevBody}</p>
          <code>{devResetToken}</code>
        </div>
      ) : null}

      <div className="form-actions auth-form-actions">
        <p className="form-note">{dictionary.auth.resetNoReveal}</p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? dictionary.auth.preparing : dictionary.auth.requestResetButton}
        </Button>
      </div>
    </form>
  );
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
