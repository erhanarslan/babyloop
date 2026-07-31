"use client";

import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { AuthPayload } from "../../lib/auth-client";
import { setAuthPayload } from "../../lib/auth-client";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { TextInput } from "../../components/ui";
import {
  completeLoginApproval,
  isLoginApprovalCompletePendingPayload,
  startGoogleLogin,
  submitAuthRequest,
  verifyMfaLogin,
  type AuthMode,
  type LoginApprovalRequiredPayload,
  type MfaRequiredPayload
} from "./api";
import {
  canSubmitWebOtpCode,
  normalizeWebOtpCode,
  transitionWebLoginFlowFromMfaVerify,
  transitionWebLoginFlowFromSubmit
} from "./web-login-flow-model";
import {
  getAuthModalErrorMessage,
  type AuthModalErrorCode
} from "./auth-modal-query";
import { storeAuthReturnTo } from "./auth-return-to";
import { useBodyScrollLock } from "../../lib/body-scroll-lock";

type AuthActionPromptModalProps = {
  apiBaseUrl: string;
  initialErrorCode?: AuthModalErrorCode | null;
  initialMode?: AuthMode;
  isOpen: boolean;
  onAuthenticated?: (payload: AuthPayload) => void;
  onClose: () => void;
  returnTo?: string | undefined;
  title: string;
};

export function AuthActionPromptModal({
  apiBaseUrl,
  initialErrorCode = null,
  initialMode = "login",
  isOpen,
  onAuthenticated,
  onClose,
  returnTo,
  title
}: AuthActionPromptModalProps) {
  const { dictionary } = useI18n();
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [loginApproval, setLoginApproval] = useState<LoginApprovalRequiredPayload | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaRequiredPayload | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const isRegister = mode === "register";
  useBodyScrollLock(isOpen && isMounted);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMode(initialMode);
    setErrorMessage(getAuthModalErrorMessage(initialErrorCode));
    setIsGoogleRedirecting(false);
    setLoginApproval(null);
    setMfaChallenge(null);
    setOtpCode("");
    setTermsAccepted(false);
  }, [initialErrorCode, initialMode, isOpen]);

  useEffect(() => {
    if (isOpen && isMounted) {
      closeButtonRef.current?.focus({ preventScroll: true });
    }
  }, [isMounted, isOpen]);

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
            setAuthPayload(authPayload);
            setLoginApproval(null);
            setErrorMessage(null);
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

    if (mfaChallenge) {
      await handleVerifyMfa();
      return;
    }

    const trimmedEmail = email.trim();
    const submittedPassword = password;
    const trimmedDisplayName = displayName.trim();
    const trimmedLocationCity = locationCity.trim();

    if (
      !trimmedEmail ||
      !submittedPassword ||
      (isRegister && (!trimmedDisplayName || !termsAccepted))
    ) {
      setErrorMessage(dictionary.auth.requiredFields);
      return;
    }

    setIsSubmitting(true);

    try {
      const body = await submitAuthRequest(apiBaseUrl, mode, {
        email: trimmedEmail,
        password: submittedPassword,
        ...(isRegister
          ? {
              displayName: trimmedDisplayName,
              termsAccepted: true,
              termsVersion: CURRENT_TERMS_VERSION
            }
          : {}),
        ...(isRegister && trimmedLocationCity ? { locationCity: trimmedLocationCity } : {})
      });

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      const stage = transitionWebLoginFlowFromSubmit(body.data, { isRegister });

      if (stage.type === "error") {
        setErrorMessage(stage.message);
        return;
      }

      if (stage.type === "mfa") {
        setPassword("");
        setMfaChallenge({
          challengeId: stage.challengeId,
          mfaRequired: true
        });
        setOtpCode("");
        return;
      }

      if (stage.type === "mobile_approval") {
        setLoginApproval(stage.approval);
        setErrorMessage("Mobil onay bekleniyor. Telefonundaki bildirimi onayladığında giriş tamamlanacak.");
        return;
      }

      if (stage.type !== "authenticated") {
        setErrorMessage("Giriş tamamlanamadı. Lütfen tekrar deneyin.");
        return;
      }

      setAuthPayload(stage.auth);
      onAuthenticated?.(stage.auth);
      onClose();
      router.refresh();
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyMfa() {
    if (!mfaChallenge) {
      return;
    }

    if (!canSubmitWebOtpCode(otpCode)) {
      setErrorMessage("E-postana gönderilen 6 haneli kodu gir.");
      return;
    }

    setIsSubmitting(true);

    try {
      const body = await verifyMfaLogin(apiBaseUrl, mfaChallenge.challengeId, otpCode);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      const stage = transitionWebLoginFlowFromMfaVerify(body.data);

      if (stage.type === "mobile_approval") {
        setMfaChallenge(null);
        setOtpCode("");
        setLoginApproval(stage.approval);
        setErrorMessage("Mobil onay bekleniyor. Telefonundaki bildirimi onayladığında giriş tamamlanacak.");
        return;
      }

      if (stage.type === "authenticated") {
        setAuthPayload(stage.auth);
        setMfaChallenge(null);
        setOtpCode("");
        onAuthenticated?.(stage.auth);
        onClose();
        router.refresh();
      }
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openGoogleLogin() {
    setErrorMessage(null);

    if (isRegister && !termsAccepted) {
      setErrorMessage(dictionary.auth.requiredFields);
      return;
    }

    setIsGoogleRedirecting(true);

    if (returnTo) {
      storeAuthReturnTo(returnTo);
    }

    try {
      const response = await startGoogleLogin(
        apiBaseUrl,
        isRegister
          ? { termsAccepted: true, termsVersion: CURRENT_TERMS_VERSION }
          : undefined
      );

      if (!response.ok) {
        setErrorMessage(
          response.error.code === "GOOGLE_AUTH_UNAVAILABLE"
            ? dictionary.auth.googleUnavailable
            : getApiErrorMessage(response.error, dictionary)
        );
        setIsGoogleRedirecting(false);
      }
    } catch {
      const fallback = new URL(`${apiBaseUrl}/api/v1/auth/google/start`);

      if (isRegister) {
        fallback.searchParams.set("termsAccepted", "true");
        fallback.searchParams.set("termsVersion", CURRENT_TERMS_VERSION);
      }

      window.location.assign(fallback.toString());
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
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <div className="market-modal-heading">
          <div>
            <p className="eyebrow">{dictionary.auth.authModalEyebrow}</p>
            <h2 id="auth-action-prompt-title">{title}</h2>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            aria-label={dictionary.publicShell.header.close}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="market-auth-tabs" role="tablist" aria-label={dictionary.auth.authModalTabsLabel}>
          <button
            role="tab"
            type="button"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setErrorMessage(null);
              setMfaChallenge(null);
              setOtpCode("");
              setTermsAccepted(false);
            }}
          >
            {dictionary.common.login}
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setErrorMessage(null);
              setMfaChallenge(null);
              setOtpCode("");
              setTermsAccepted(false);
            }}
          >
            {dictionary.common.register}
          </button>
        </div>

        <button
          className="market-google-auth-button"
          type="button"
          disabled={isSubmitting || isGoogleRedirecting || (isRegister && !termsAccepted)}
          onClick={openGoogleLogin}
        >
          <span aria-hidden="true">G</span>
          {isGoogleRedirecting ? dictionary.auth.openingGoogle : dictionary.auth.continueGoogle}
        </button>

        {errorMessage ? (
          <p className="market-auth-modal-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="auth-divider" aria-hidden="true">
          <span>{dictionary.auth.divider}</span>
        </div>

        <form aria-busy={isSubmitting} className="market-auth-modal-form" onSubmit={handleSubmit}>
          {mfaChallenge ? (
            <>
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="text-base font-black text-foreground">OTP doğrulaması</h3>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  E-postana gönderilen 6 haneli kodu gir.
                </p>
              </div>
              <label>
                <span>OTP kodu</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  name="otpCode"
                  pattern="[0-9]{6}"
                  value={otpCode}
                  onChange={(event) => setOtpCode(normalizeWebOtpCode(event.target.value))}
                />
              </label>
              <button
                className="market-auth-link-button"
                type="button"
                onClick={() => {
                  setMfaChallenge(null);
                  setOtpCode("");
                  setErrorMessage(null);
                }}
              >
                Girişe geri dön
              </button>
            </>
          ) : isRegister ? (
            <>
              <label>
                <span>{dictionary.auth.fullName}</span>
                <input
                  name="displayName"
                  value={displayName}
                  autoComplete="name"
                  minLength={2}
                  maxLength={120}
                  required
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>

              <label>
                <span>{dictionary.common.city}</span>
                <input
                  name="locationCity"
                  value={locationCity}
                  autoComplete="address-level2"
                  maxLength={120}
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
              maxLength={320}
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <TextInput
            autoComplete={isRegister ? "new-password" : "current-password"}
            label={dictionary.common.password}
            name="password"
            type="password"
            value={password}
            minLength={8}
            maxLength={128}
            required
            onChange={(event) => setPassword(event.target.value)}
          />

          {isRegister ? (
            <section
              className="auth-legal-notice market-auth-legal-notice"
              aria-label="Kayıt sözleşmesi ve KVKK bilgilendirmesi"
            >
              <p>
                Hesap bilgilerin kayıt ve güvenlik amacıyla işlenir. Ayrıntılar için{" "}
                <Link href="/legal/kvkk" target="_blank">KVKK Aydınlatma Metni</Link> ve{" "}
                <Link href="/legal/privacy" target="_blank">Gizlilik Politikası</Link> sayfalarını inceleyebilirsin.
              </p>
              <label className="auth-terms-checkbox">
                <input
                  checked={termsAccepted}
                  name="termsAccepted"
                  type="checkbox"
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                />
                <span>
                  <Link href="/legal/terms" target="_blank">Kullanım Koşulları</Link>&apos;nı
                  (sürüm {CURRENT_TERMS_VERSION}) okudum ve kabul ediyorum.
                </span>
              </label>
            </section>
          ) : null}

          <button
            className="market-sell-cta market-auth-submit-button"
            type="submit"
            disabled={
              isSubmitting ||
              Boolean(loginApproval) ||
              (isRegister && !termsAccepted) ||
              (Boolean(mfaChallenge) && !canSubmitWebOtpCode(otpCode))
            }
          >
            {mfaChallenge
              ? isSubmitting
                ? "OTP doğrulanıyor..."
                : "OTP kodunu doğrula"
              : isSubmitting
                ? dictionary.auth.submitting
                : isRegister
                  ? dictionary.common.register
                  : dictionary.common.login}
          </button>
        </form>
      </section>
    </div>,
    document.body
  );
}
