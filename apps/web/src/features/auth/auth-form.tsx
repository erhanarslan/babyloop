"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button } from "../../components/ui";
import { setAuthToken } from "../../lib/auth-client";
import { AuthFields } from "./auth-fields";
import { startGoogleLogin, submitAuthRequest, type AuthMode } from "./api";

type AuthFormProps = {
  apiBaseUrl: string;
  mode: AuthMode;
};

export function AuthForm({ apiBaseUrl, mode }: AuthFormProps) {
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
      setErrorMessage("Please complete the required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const body = await submitAuthRequest(apiBaseUrl, mode, payload);

      if (!body.ok) {
        setErrorMessage(body.error.message);
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
      setErrorMessage("BabyLoop API is unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="listing-form" onSubmit={handleSubmit}>
      <div className="google-auth-actions">
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
                    ? "Google sign-in is not configured in this environment."
                    : response.error.message
                );
                setIsGoogleRedirecting(false);
              }
            } catch {
              window.location.assign(`${apiBaseUrl}/api/v1/auth/google/start`);
            }
          }}
        >
          {isGoogleRedirecting ? "Opening Google..." : "Continue with Google"}
        </Button>
      </div>

      <div className="auth-divider" aria-hidden="true">
        <span>or</span>
      </div>

      <AuthFields mode={mode} />

      {errorMessage ? (
        <Alert title="Account request failed" message={errorMessage} />
      ) : null}

      {registrationComplete ? (
        <div className="dev-token-panel">
          <h2>Registration successful</h2>
          {devEmailVerificationToken ? (
            <>
              <p>
                Real email delivery is not implemented yet. Use this local development link to
                verify the account.
              </p>
              <Link href={`/auth/verify-email?token=${encodeURIComponent(devEmailVerificationToken)}`}>
                Verify email locally
              </Link>
            </>
          ) : (
            <p>
              Registration successful. Email verification will be required when email delivery is
              configured.
            </p>
          )}
        </div>
      ) : null}

      <div className="form-actions">
        <p className="form-note">
          {isRegister ? "Creates a user and marketplace profile." : "Uses your BabyLoop token."}
        </p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : isRegister ? "Create account" : "Login"}
        </Button>
      </div>
    </form>
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
