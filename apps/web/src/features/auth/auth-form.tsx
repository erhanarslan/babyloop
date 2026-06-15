"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button } from "../../components/ui";
import { setAuthToken } from "../../lib/auth-client";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { AuthFields } from "./auth-fields";
import { startGoogleLogin, submitAuthRequest, type AuthMode } from "./api";

type AuthFormProps = {
  apiBaseUrl: string;
  mode: AuthMode;
};

export function AuthForm({ apiBaseUrl, mode }: AuthFormProps) {
  const { dictionary } = useI18n();
  const router = useRouter();
  const [devEmailVerificationToken, setDevEmailVerificationToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDevEmailVerificationToken(null);
    setErrorMessage(null);
    setRegistrationComplete(false);

    const payload = buildAuthPayload(new FormData(event.currentTarget), isRegister);

    if (!payload) {
      setErrorMessage(dictionary.auth.requiredFields);
      return;
    }

    setIsSubmitting(true);

    try {
      const body = await submitAuthRequest(apiBaseUrl, mode, payload);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setAuthToken(body.data.accessToken);

      if (isRegister) {
        setDevEmailVerificationToken(body.data.devEmailVerificationToken ?? null);
        setRegistrationComplete(true);
        router.refresh();
        return;
      }

      router.push("/browse");
      router.refresh();
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="listing-form auth-form-polished" onSubmit={handleSubmit}>
      <div className="auth-form-intro">
        <p className="eyebrow">{isRegister ? "Create protected access" : "Protected sign in"}</p>
        <h2>{isRegister ? "Create your BabyLoop account" : "Continue to your BabyLoop workspace"}</h2>
        <p>
          {isRegister
            ? "Use account access for listing creation, messages, saved searches, child age-band planning, and seller tools."
            : "Sign in to reach private marketplace tools without storing long-lived tokens in browser storage."}
        </p>
      </div>

      <div className="google-auth-actions google-auth-actions-polished">
        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting || isGoogleRedirecting}
          onClick={async () => {
            setErrorMessage(null);
            setIsGoogleRedirecting(true);
            try {
              const response = await startGoogleLogin(apiBaseUrl);

              if (!response.ok) {
                setErrorMessage(
                  response.error.code === "GOOGLE_AUTH_UNAVAILABLE"
                    ? dictionary.auth.googleUnavailable
                    : getApiErrorMessage(response.error, dictionary)
                );
                setIsGoogleRedirecting(false);
              }
            } catch {
              window.location.assign(`${apiBaseUrl}/api/v1/auth/google/start`);
            }
          }}
        >
          <GoogleIcon />
          {isGoogleRedirecting ? dictionary.auth.openingGoogle : dictionary.auth.continueGoogle}
        </Button>
        <p className="form-note">
          Google sign-in falls back to email and password when it is not configured for this environment.
        </p>
      </div>

      <div className="auth-divider" aria-hidden="true">
        <span>{dictionary.auth.divider}</span>
      </div>

      <AuthFields mode={mode} />

      <div className="auth-security-summary" aria-label="Auth security summary">
        <div>
          <strong>Session boundary</strong>
          <span>Logout clears the client session and asks the API to end the cookie-backed session.</span>
        </div>
        <div>
          <strong>Private surfaces</strong>
          <span>Messages, favorites, seller tools, and account pages stay behind authenticated requests.</span>
        </div>
      </div>

      {errorMessage ? (
        <Alert title={dictionary.auth.accountFailed} message={errorMessage} />
      ) : null}

      {registrationComplete ? (
        <div className="dev-token-panel auth-success-panel">
          <h2>{dictionary.auth.registrationSuccess}</h2>
          {devEmailVerificationToken ? (
            <>
              <p>{dictionary.auth.emailDevLink}</p>
              <Link href={`/auth/verify-email?token=${encodeURIComponent(devEmailVerificationToken)}`}>
                {dictionary.auth.verifyLocally}
              </Link>
            </>
          ) : (
            <p>{dictionary.auth.emailWillBeRequired}</p>
          )}
        </div>
      ) : null}

      <div className="form-actions auth-form-actions">
        <p className="form-note">
          {isRegister ? dictionary.auth.registerNote : dictionary.auth.loginNote}
        </p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? dictionary.auth.submitting
            : isRegister
              ? dictionary.auth.submitRegister
              : dictionary.auth.submitLogin}
        </Button>
      </div>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.72-.06-1.24-.19-1.77H12v3.42h5.52c-.11.85-.71 2.13-2.04 2.99l-.02.11 2.96 2.12.21.02c1.92-1.64 3.03-4.06 3.03-6.89Z"
      />
      <path
        fill="#34A853"
        d="M12 21c2.75 0 5.05-.84 6.73-2.28l-3.2-2.29c-.86.55-2.01.94-3.53.94a6.1 6.1 0 0 1-5.76-3.89l-.12.01-3.08 2.2-.04.1A10.02 10.02 0 0 0 12 21Z"
      />
      <path
        fill="#FBBC05"
        d="M6.24 13.48A5.55 5.55 0 0 1 5.91 12c0-.51.12-1.01.31-1.48l-.01-.12-3.12-2.24-.1.04A8.56 8.56 0 0 0 2 12c0 1.37.36 2.66.99 3.8l3.25-2.32Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.63c1.91 0 3.2.76 3.94 1.4l2.88-2.6C17.05 1.91 14.75 1 12 1a10.02 10.02 0 0 0-9 5.6l3.23 2.32A6.12 6.12 0 0 1 12 4.63Z"
      />
    </svg>
  );
}

function buildAuthPayload(formData: FormData, isRegister: boolean) {
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const displayName = getString(formData, "displayName");
  const locationCity = getString(formData, "locationCity");

  if (!email || !password || (isRegister && !displayName)) {
    return null;
  }

  return {
    email,
    password,
    ...(isRegister ? { displayName } : {}),
    ...(isRegister && locationCity ? { locationCity } : {})
  };
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
