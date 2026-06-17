"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { AuthPayload } from "../../lib/auth-client";
import { setAuthToken } from "../../lib/auth-client";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { startGoogleLogin, submitAuthRequest, type AuthMode } from "./api";

type AuthActionPromptModalProps = {
  apiBaseUrl: string;
  isOpen: boolean;
  onAuthenticated?: (payload: AuthPayload) => void;
  onClose: () => void;
  title: string;
};

const AUTH_RETURN_TO_STORAGE_KEY = "babyloop_auth_return_to";

export function AuthActionPromptModal({
  apiBaseUrl,
  isOpen,
  onAuthenticated,
  onClose,
  title
}: AuthActionPromptModalProps) {
  const { dictionary } = useI18n();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isOpen || !isMounted) {
    return null;
  }

  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedDisplayName = displayName.trim();
    const trimmedLocationCity = locationCity.trim();

    if (!trimmedEmail || !trimmedPassword || (isRegister && !trimmedDisplayName)) {
      setErrorMessage(dictionary.auth.requiredFields);
      return;
    }

    setIsSubmitting(true);

    try {
      const body = await submitAuthRequest(apiBaseUrl, mode, {
        email: trimmedEmail,
        password: trimmedPassword,
        ...(isRegister ? { displayName: trimmedDisplayName } : {}),
        ...(isRegister && trimmedLocationCity ? { locationCity: trimmedLocationCity } : {})
      });

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setAuthToken(body.data.accessToken);
      onAuthenticated?.(body.data);
      onClose();
      router.refresh();
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openGoogleLogin() {
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
  }

  return createPortal(
    <div className="market-modal-layer" role="presentation">
      <button
        aria-label={dictionary.publicShell.header.close}
        className="market-modal-backdrop"
        type="button"
        onClick={onClose}
      />

      <section
        className="market-modal-card market-auth-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-action-prompt-title"
      >
        <div className="market-modal-heading">
          <div>
            <p className="eyebrow">BABYLOOP</p>
            <h2 id="auth-action-prompt-title">{title}</h2>
          </div>

          <button type="button" aria-label={dictionary.publicShell.header.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="market-auth-tabs" role="tablist" aria-label="Giriş seçimi">
          <button
            type="button"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setErrorMessage(null);
            }}
          >
            Giriş yap
          </button>
          <button
            type="button"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setErrorMessage(null);
            }}
          >
            Hesap oluştur
          </button>
        </div>

        <button
          className="market-google-auth-button"
          type="button"
          disabled={isSubmitting || isGoogleRedirecting}
          onClick={openGoogleLogin}
        >
          <span aria-hidden="true">G</span>
          {isGoogleRedirecting ? "Google açılıyor..." : "Google ile devam et"}
        </button>

        <div className="auth-divider" aria-hidden="true">
          <span>veya</span>
        </div>

        <form className="market-auth-modal-form" onSubmit={handleSubmit}>
          {isRegister ? (
            <>
              <label>
                <span>Ad soyad</span>
                <input
                  name="displayName"
                  value={displayName}
                  autoComplete="name"
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>

              <label>
                <span>Şehir</span>
                <input
                  name="locationCity"
                  value={locationCity}
                  autoComplete="address-level2"
                  placeholder="İstanbul"
                  onChange={(event) => setLocationCity(event.target.value)}
                />
              </label>
            </>
          ) : null}

          <label>
            <span>E-posta</span>
            <input
              name="email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            <span>Şifre</span>
            <input
              name="password"
              type="password"
              value={password}
              autoComplete={isRegister ? "new-password" : "current-password"}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {errorMessage ? (
            <p className="market-auth-modal-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="market-sell-cta market-auth-submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? dictionary.auth.submitting : isRegister ? "Hesap oluştur" : "Giriş yap"}
          </button>
        </form>
      </section>
    </div>,
    document.body
  );
}

export function getStoredAuthReturnTo(fallback = "/"): string {
  if (typeof window === "undefined") {
    return fallback;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const queryReturnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  if (queryReturnTo) {
    sessionStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, queryReturnTo);
    return queryReturnTo;
  }

  return sanitizeReturnTo(sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY)) ?? fallback;
}

export function clearStoredAuthReturnTo() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
  }
}

function sanitizeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

