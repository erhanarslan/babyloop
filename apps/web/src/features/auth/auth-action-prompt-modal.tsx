"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { AuthPayload } from "../../lib/auth-client";
import { setAuthToken } from "../../lib/auth-client";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import {
  completeLoginApproval,
  isLoginApprovalCompletePendingPayload,
  startGoogleLogin,
  submitAuthRequest,
  type AuthMode,
  type LoginApprovalRequiredPayload
} from "./api";

type AuthActionPromptModalProps = {
  apiBaseUrl: string;
  isOpen: boolean;
  onAuthenticated?: (payload: AuthPayload) => void;
  onClose: () => void;
  returnTo?: string | undefined;
  title: string;
};

const AUTH_RETURN_TO_STORAGE_KEY = "babyloop_auth_return_to";

export function AuthActionPromptModal({
  apiBaseUrl,
  isOpen,
  onAuthenticated,
  onClose,
  returnTo,
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

  const [loginApproval, setLoginApproval] = useState<LoginApprovalRequiredPayload | null>(null);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!loginApproval) {
      return;
    }

    const approval = loginApproval;
    let active = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const expiresAt = new Date(approval.expiresAt).getTime();

    async function tryCompletePromptLoginApproval() {
      if (!active || inFlight) {
        return;
      }

      if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
        active = false;
        setLoginApproval(null);
        setErrorMessage("Mobil onay süresi doldu. Lütfen tekrar giriş yap.");
        return;
      }

      inFlight = true;

      try {
        const response = await completeLoginApproval(apiBaseUrl, approval.approvalToken);

        if (response.ok) {
          const authPayload = response.data;

          if (!isLoginApprovalCompletePendingPayload(authPayload)) {
            active = false;
            setAuthToken(authPayload.accessToken);
            setLoginApproval(null);
            setErrorMessage(null);
            window.dispatchEvent(new Event("babyloop-auth-change"));
            onAuthenticated?.(authPayload);
            onClose();
            router.refresh();
            return;
          }
        }
      } catch {
        // Geçici ağ/API hatalarında onay süresi dolana kadar tekrar denenir.
      } finally {
        inFlight = false;
      }

      if (active) {
        timer = setTimeout(() => {
          void tryCompletePromptLoginApproval();
        }, 1000);
      }
    }

    timer = setTimeout(() => {
      void tryCompletePromptLoginApproval();
    }, 750);

    return () => {
      active = false;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [apiBaseUrl, loginApproval, onAuthenticated, onClose, router]);

  if (!isOpen || !isMounted) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setLoginApproval(null);

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

      if ("loginApprovalRequired" in body.data) {
        setLoginApproval(body.data);
        setErrorMessage("Mobil onay bekleniyor. Telefonundaki bildirimi onayladığında giriş tamamlanacak.");
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
            <p className="eyebrow">{dictionary.auth.authModalEyebrow}</p>
            <h2 id="auth-action-prompt-title">{title}</h2>
          </div>

          <button type="button" aria-label={dictionary.publicShell.header.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="market-auth-tabs" role="tablist" aria-label={dictionary.auth.authModalTabsLabel}>
          <button
            type="button"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setErrorMessage(null);
            }}
          >
            {dictionary.common.login}
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
            {dictionary.common.register}
          </button>
        </div>

        <button
          className="market-google-auth-button"
          type="button"
          disabled={isSubmitting || isGoogleRedirecting}
          onClick={openGoogleLogin}
        >
          <span aria-hidden="true">G</span>
          {isGoogleRedirecting ? dictionary.auth.openingGoogle : dictionary.auth.continueGoogle}
        </button>

        <div className="auth-divider" aria-hidden="true">
          <span>{dictionary.auth.divider}</span>
        </div>

        <form className="market-auth-modal-form" onSubmit={handleSubmit}>
          {isRegister ? (
            <>
              <label>
                <span>{dictionary.auth.fullName}</span>
                <input
                  name="displayName"
                  value={displayName}
                  autoComplete="name"
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>

              <label>
                <span>{dictionary.common.city}</span>
                <input
                  name="locationCity"
                  value={locationCity}
                  autoComplete="address-level2"
                  placeholder={dictionary.auth.locationPlaceholder}
                  onChange={(event) => setLocationCity(event.target.value)}
                />
              </label>
            </>
          ) : null}

          <label>
            <span>{dictionary.common.email}</span>
            <input
              name="email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            <span>{dictionary.common.password}</span>
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
            {isSubmitting ? dictionary.auth.submitting : isRegister ? dictionary.common.register : dictionary.common.login}
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
