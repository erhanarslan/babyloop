"use client";

import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "../../components/ui";
import { setAuthPayload } from "../../lib/auth-client";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { AuthFields } from "./auth-fields";
import {
  clearStoredAuthReturnTo,
  getStoredAuthReturnTo
} from "./auth-return-to";
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
  const [mfaChallenge, setMfaChallenge] = useState<MfaRequiredPayload | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [approvalSecondsLeft, setApprovalSecondsLeft] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registrationEmailDeferred, setRegistrationEmailDeferred] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const submitInFlightRef = useRef(false);
  const isRegister = mode === "register";

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (retryAfterSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRetryAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (!loginApproval) {
      return;
    }

    const approval = loginApproval;
    let active = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const expiresAt = new Date(approval.expiresAt).getTime();

    async function tryCompleteApprovedLogin() {
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

            const returnTo = getStoredAuthReturnTo("/account");
            clearStoredAuthReturnTo();
            router.replace(returnTo);
            router.refresh();
            return;
          }
        }

        // Onay henüz verilmeden /complete endpoint'i invalid dönebilir.
        // Bu durumda hataya düşmek yerine süre dolana kadar poll etmeye devam et.
      } catch {
        // Geçici ağ/API hatalarında da onay süresi dolana kadar poll devam eder.
      } finally {
        inFlight = false;
      }

      if (active) {
        timer = setTimeout(() => {
          void tryCompleteApprovedLogin();
        }, 1000);
      }
    }

    timer = setTimeout(() => {
      void tryCompleteApprovedLogin();
    }, 750);

    return () => {
      active = false;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [apiBaseUrl, loginApproval, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitInFlightRef.current || retryAfterSeconds > 0) {
      return;
    }
    setDevEmailVerificationToken(null);
    setErrorMessage(null);
    setLoginApproval(null);
    setSuccessMessage(null);
    setRegistrationComplete(false);

    if (mfaChallenge) {
      await handleVerifyMfa();
      return;
    }

    const payload = buildAuthPayload(new FormData(event.currentTarget), isRegister, termsAccepted);

    if (!payload) {
      setErrorMessage(dictionary.auth.requiredFields);
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const body = await submitAuthRequest(apiBaseUrl, mode, payload);

      if (!body.ok) {
        if (body.httpStatus === 429) {
          setRetryAfterSeconds(body.retryAfterSeconds ?? 60);
        }
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      const stage = transitionWebLoginFlowFromSubmit(body.data, { isRegister });

      if (stage.type === "error") {
        setErrorMessage(stage.message);
        return;
      }

      if (stage.type === "mfa") {
        event.currentTarget.reset();
        setMfaChallenge({
          challengeId: stage.challengeId,
          mfaRequired: true
        });
        setOtpCode("");
        return;
      }

      if (stage.type === "mobile_approval") {
        setLoginApproval(stage.approval);
        setApprovalSecondsLeft(secondsUntil(stage.approval.expiresAt));
        return;
      }

      if (stage.type !== "authenticated") {
        setErrorMessage("Giriş tamamlanamadı. Lütfen tekrar deneyin.");
        return;
      }

      setAuthPayload(stage.auth);

      if (isRegister) {
        setDevEmailVerificationToken(stage.auth.devEmailVerificationToken ?? null);
        setRegistrationEmailDeferred(stage.auth.emailVerificationDelivery === "deferred");
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
      submitInFlightRef.current = false;
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
        setApprovalSecondsLeft(secondsUntil(stage.approval.expiresAt));
        return;
      }

      if (stage.type === "authenticated") {
        setAuthPayload(stage.auth);
        setMfaChallenge(null);
        setOtpCode("");
        const returnTo = getStoredAuthReturnTo("/browse");
        clearStoredAuthReturnTo();
        router.push(returnTo);
        router.refresh();
      }
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

  function handleCancelMfa() {
    setMfaChallenge(null);
    setOtpCode("");
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="listing-form auth-form-polished"
      method="post"
      onSubmit={handleSubmit}
    >
      <div className="auth-form-intro">
        <p className="eyebrow">
          {isRegister
            ? dictionary.authPageShell.register.eyebrow
            : dictionary.authPageShell.login.eyebrow}
        </p>
        <h2>{isRegister ? dictionary.auth.registerTitle : dictionary.auth.loginTitle}</h2>
        <p>{isRegister ? dictionary.auth.registerDescription : dictionary.auth.loginDescription}</p>
      </div>

      <div className="google-auth-actions google-auth-actions-polished">
        <Button
          type="button"
          variant="secondary"
          disabled={
            isSubmitting ||
            isGoogleRedirecting ||
            Boolean(loginApproval) ||
            (isRegister && !termsAccepted)
          }
          onClick={async () => {
            setErrorMessage(null);
            setIsGoogleRedirecting(true);
            try {
              const response = await startGoogleLogin(
                apiBaseUrl,
                isRegister && termsAccepted
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
              if (isRegister && termsAccepted) {
                fallback.searchParams.set("termsAccepted", "true");
                fallback.searchParams.set("termsVersion", CURRENT_TERMS_VERSION);
              }
              window.location.assign(fallback.toString());
            }
          }}
        >
          <GoogleIcon />
          {isGoogleRedirecting ? dictionary.auth.openingGoogle : dictionary.auth.continueGoogle}
        </Button>
        <p className="form-note">
          Google ile giriş kullanılamıyorsa e-posta ve şifreyle devam edebilirsin.
        </p>
      </div>

      <div className="auth-divider" aria-hidden="true">
        <span>{dictionary.auth.divider}</span>
      </div>

      {mfaChallenge ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-4">
          <div>
            <h3 className="text-base font-black text-foreground">OTP doğrulaması</h3>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              E-postana gönderilen 6 haneli kodu gir.
            </p>
          </div>
          <label className="grid gap-1 text-sm font-bold text-foreground">
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
          <Button type="button" variant="secondary" onClick={handleCancelMfa}>
            Girişe geri dön
          </Button>
        </div>
      ) : (
        <AuthFields mode={mode} />
      )}

      {isRegister ? (
        <section className="auth-legal-notice" aria-label="Kayıt sözleşmesi ve KVKK bilgilendirmesi">
          <p>
            Hesap bilgilerin; kayıt, güvenlik, pazaryeri ve destek amaçlarıyla işlenir. Ayrıntılar için
            {" "}<Link href="/legal/kvkk" target="_blank">KVKK Aydınlatma Metni</Link> ve
            {" "}<Link href="/legal/privacy" target="_blank">Gizlilik Politikası</Link> sayfalarını inceleyebilirsin.
            Bu bilgilendirme açık rıza talebi değildir.
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

      {!isRegister ? (
        <div className="auth-security-summary" aria-label={dictionary.authPageShell.assuranceLabel}>
          <div>
            <strong>{dictionary.authPageShell.login.badge}</strong>
            <span>{dictionary.authPageShell.login.checks[0]}</span>
          </div>
          <div>
            <strong>{dictionary.authPageShell.assuranceTitle}</strong>
            <span>{dictionary.authPageShell.assuranceBody}</span>
          </div>
        </div>
      ) : null}

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

      {retryAfterSeconds > 0 ? (
        <p role="status">Tekrar denemeden önce {retryAfterSeconds} saniye bekle.</p>
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
          {registrationEmailDeferred ? (
            <p role="status">
              Hesabın oluşturuldu; doğrulama e-postası gecikti. Doğrulama ekranından güvenle yeniden isteyebilirsin.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="form-actions auth-form-actions">
        <p className="form-note">
          {isRegister ? dictionary.auth.registerNote : dictionary.auth.loginNote}
        </p>
        <Button
          type="submit"
          disabled={
            !isHydrated ||
            isSubmitting ||
            retryAfterSeconds > 0 ||
            Boolean(loginApproval) ||
            (isRegister && !termsAccepted) ||
            (Boolean(mfaChallenge) && !canSubmitWebOtpCode(otpCode))
          }
        >
          {loginApproval
            ? "Mobil onay bekleniyor"
            : mfaChallenge
              ? isSubmitting
                ? "OTP doğrulanıyor..."
                : "OTP kodunu doğrula"
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

export function buildAuthPayload(formData: FormData, isRegister: boolean, termsAccepted: boolean) {
  const email = getString(formData, "email");
  const password = getString(formData, "password", false);
  const displayName = getString(formData, "displayName");
  const locationCity = getString(formData, "locationCity");

  if (!email || !password || (isRegister && (!displayName || !termsAccepted))) {
    return null;
  }

  return {
    email,
    password,
    ...(isRegister
      ? {
          displayName,
          termsAccepted: true as const,
          termsVersion: CURRENT_TERMS_VERSION
        }
      : {}),
    ...(isRegister && locationCity ? { locationCity } : {})
  };
}

function getString(formData: FormData, key: string, trim = true): string {
  const value = formData.get(key);
  return typeof value === "string" ? (trim ? value.trim() : value) : "";
}
