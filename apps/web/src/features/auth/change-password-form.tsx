"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";
import { Alert, Button, LoadingBlock, TextInput } from "../../components/ui";
import { clearAuthToken } from "../../lib/auth-client";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { changePassword } from "./api";

type ChangePasswordFormProps = {
  apiBaseUrl: string;
};

export function ChangePasswordForm({ apiBaseUrl }: ChangePasswordFormProps) {
  const { dictionary } = useI18n();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const clearProtectedState = useCallback(() => {
    setErrorMessage(null);
    setIsSubmitting(false);
  }, []);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!(await requireAuth())) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const currentPassword = getString(formData, "currentPassword");
    const newPassword = getString(formData, "newPassword");
    const confirmPassword = getString(formData, "confirmPassword");

    if (!currentPassword) {
      setErrorMessage(dictionary.auth.currentPasswordRequired);
      return;
    }

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
      const body = await changePassword(apiBaseUrl, currentPassword, newPassword);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      clearAuthToken({ broadcast: true });
      router.replace("/login?passwordChanged=1");
      router.refresh();
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingAuth) {
    return <LoadingBlock title={dictionary.common.loading} />;
  }

  return (
    <form className="listing-form auth-recovery-form" onSubmit={handleSubmit}>
      <div className="auth-form-intro">
        <p className="eyebrow">Şifre</p>
        <h2>Şifreni güncelle</h2>
        <p>
          Şifre değişince tekrar giriş yapman gerekir.
        </p>
      </div>

      <div className="form-grid">
        <TextInput
          label={dictionary.auth.currentPassword}
          name="currentPassword"
          type="password"
          maxLength={128}
          required
          wide
        />
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
          <strong>Oturum yenilenir</strong>
          <span>{dictionary.auth.passwordChangeNote}</span>
        </div>
        <div>
          <strong>Güvenli kullanım</strong>
          <span>Şifreni mesajlarda, ilanlarda veya asistan sorularında paylaşma.</span>
        </div>
      </div>

      {errorMessage ? <Alert title={dictionary.auth.passwordChangeFailed} message={errorMessage} /> : null}

      <div className="form-actions auth-form-actions">
        <p className="form-note">{dictionary.auth.passwordChangeNote}</p>
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
