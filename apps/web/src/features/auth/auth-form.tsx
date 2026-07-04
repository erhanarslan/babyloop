"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Alert, Button } from "../../components/ui";
import { setAuthToken } from "../../lib/auth-client";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { AuthFields } from "./auth-fields";
import {
  clearStoredAuthReturnTo,
  getStoredAuthReturnTo
} from "./auth-action-prompt-modal";
import {
  completeLoginApproval,
  startGoogleLogin,
  submitAuthRequest,
  type AuthMode,
  type LoginApprovalRequiredPayload
} from "./api";

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
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginApproval, setLoginApproval] = useState<LoginApprovalRequiredPayload | null>(null);
  const [approvalSecondsLeft, setApprovalSecondsLeft] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const isRegister = mode === "register";

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!loginApproval) {
      setApprovalSecondsLeft(0);
      return;
    }

    function updateSecondsLeft() {
      const expiresAt = new Date(loginApproval!.expiresAt).getTime();
      const secondsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

      setApprovalSecondsLeft(secondsLeft);

      if (secondsLeft <= 0) {
        setLoginApproval(null);
        setErrorMessage("Mobil onay süresi doldu. Lütfen tekrar giriş yap.");
      }
    }

    updateSecondsLeft();
    const intervalId = window.setInterval(updateSecondsLeft, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loginApproval]);

  useEffect(() => {
    if (!loginApproval) {
      return;
    }

    let active = true;
    let inFlight = false;
    let timerId: number | null = null;

    async function attemptComplete() {
      if (!active || inFlight || !loginApproval) {
        return;
      }

      const expiresAt = new Date(loginApproval.expiresAt).getTime();

      if (Date.now() >= expiresAt) {
        return;
      }

      inFlight = true;

      try {
        const response = await completeLoginApproval(apiBaseUrl, loginApproval.approvalToken);

        if (!active) {
          return;
        }

        if (response.ok) {
          setAuthToken(response.data.accessToken);
          setLoginApproval(null);
          setErrorMessage(null);
          setSuccessMessage("Giriş yapıldı. Hesap bilgilerin güncelleniyor...");

          router.refresh();

          const returnTo = getStoredAuthReturnTo("/browse");

          window.setTimeout(() => {
            clearStoredAuthReturnTo();
            router.push(returnTo);
            router.refresh();
          }, 2000);

          return;
        }
      } catch {
        // Pending state is expected until the mobile device approves the request.
      } finally {
        inFlight = false;
      }

      if (active) {
        timerId = window.setTimeout(attemptComplete, 1000);
      }
    }

    timerId = window.setTimeout(attemptComplete, 500);

    return () => {
      active = false;

      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [apiBaseUrl, loginApproval, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDevEmailVerificationToken(null);
    setErrorMessage(null);
    setLoginApproval(null);
    setSuccessMessage(null);
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

      if (isLoginApprovalRequired(body.data)) {
        if (isRegister) {
          setErrorMessage("Kayıt sırasında mobil onay beklenmiyordu. Lütfen tekrar deneyin.");
          return;
        }

        setLoginApproval(body.data);
        setApprovalSecondsLeft(secondsUntil(body.data.expiresAt));
        return;
      }

      setAuthToken(body.data.accessToken);

      if (isRegister) {
        setDevEmailVerificationToken(body.data.devEmailVerificationToken ?? null);
        setRegistrationComplete(true);
        router.refresh();
        return;
      }

      const returnTo = getStoredAuthReturnTo("/browse");
      clearStoredAuthReturnTo();
      router.push(returnTo);
      router.refresh();
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancelApproval() {
    setLoginApproval(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  return (
    <form className="listing-form auth-form-polished" method="post" onSubmit={handleSubmit}>
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
          disabled={isSubmitting || isGoogleRedirecting || Boolean(loginApproval)}
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

      {successMessage ? (
        <div className="dev-token-panel auth-success-panel" role="status">
          <h2>Giriş yapıldı</h2>
          <p>{successMessage}</p>
        </div>
      ) : null}

      {loginApproval ? (
        <div className="dev-token-panel auth-success-panel" role="status">
          <h2>Mobil onay bekleniyor</h2>
          <p>
            {loginApproval.deviceLabel} için giriş isteği oluşturuldu. Mobil uygulamadan onay verir vermez
            bu ekran otomatik devam edecek.
          </p>
          <p className="form-note">
            Kalan süre: <strong>{approvalSecondsLeft}</strong> saniye
          </p>
          <Button type="button" variant="secondary" onClick={handleCancelApproval}>
            İptal et
          </Button>
        </div>
      ) : null}

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
        <Button type="submit" disabled={!isHydrated || isSubmitting || Boolean(loginApproval)}>
          {loginApproval
            ? "Mobil onay bekleniyor"
            : isSubmitting
              ? dictionary.auth.submitting
              : isRegister
                ? dictionary.auth.submitRegister
                : dictionary.auth.submitLogin}
        </Button>
      </div>
    </form>
  );
}

function isLoginApprovalRequired(value: unknown): value is LoginApprovalRequiredPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "loginApprovalRequired" in value &&
    (value as { loginApprovalRequired?: unknown }).loginApprovalRequired === true
  );
}

function secondsUntil(expiresAt: string): number {
  const time = new Date(expiresAt).getTime();

  if (Number.isNaN(time)) {
    return 0;
  }

  return Math.max(0, Math.ceil((time - Date.now()) / 1000));
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
