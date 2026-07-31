"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "../../lib/api";
import {
  buildBackofficeGoogleStartUrl,
  loginBackoffice,
  resolveBackofficeOAuthErrorMessage
} from "../../lib/auth-client";
import { resolveSafeBackofficeNextPath } from "../../lib/safe-next-path";

export default function BackofficeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submitInFlightRef = useRef(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const googleRedirectInFlightRef = useRef(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("authError");
    setErrorMessage(resolveBackofficeOAuthErrorMessage(error));
  }, []);

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setRetryAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [retryAfterSeconds]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitInFlightRef.current || retryAfterSeconds > 0) {
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await loginBackoffice(getApiBaseUrl(), { email, password });

    submitInFlightRef.current = false;
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      setRetryAfterSeconds(result.retryAfterSeconds ?? 0);
      return;
    }

    const nextPath = resolveSafeBackofficeNextPath(
      new URLSearchParams(window.location.search).get("next"),
    );
    router.replace(nextPath);
  }

  function handleGoogleLogin() {
    if (googleRedirectInFlightRef.current) return;
    googleRedirectInFlightRef.current = true;
    setIsGoogleRedirecting(true);
    setErrorMessage(null);

    const nextPath = resolveSafeBackofficeNextPath(
      new URLSearchParams(window.location.search).get("next"),
    );
    window.location.assign(buildBackofficeGoogleStartUrl(getApiBaseUrl(), nextPath));
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">BabyLoop Backoffice</p>
        <h1>Giriş yap</h1>
        <p>
          BabyLoop hesabınla giriş yap. Normal hesaplar ürünü salt okunur tanıtım
          modunda inceler; yetkili ekip rolleri kendi operasyon alanlarına erişir.
        </p>

        <button
          aria-label="Google ile devam et"
          className="google-auth-action"
          disabled={isGoogleRedirecting || isSubmitting}
          onClick={handleGoogleLogin}
          type="button"
        >
          <span aria-hidden="true" className="google-auth-mark">G</span>
          {isGoogleRedirecting ? "Google’a yönlendiriliyor…" : "Google ile devam et"}
        </button>

        <div aria-label="veya" className="login-divider" role="separator">
          <span>veya</span>
        </div>

        <form aria-busy={isSubmitting} className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>E-posta</span>
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            <span>Şifre</span>
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {retryAfterSeconds > 0 ? (
            <p role="status">Tekrar denemeden önce {retryAfterSeconds} saniye bekle.</p>
          ) : null}

          <button className="primary-action" disabled={isSubmitting || isGoogleRedirecting || retryAfterSeconds > 0} type="submit">
            {isSubmitting ? "Giriş yapılıyor…" : "Şifreyle giriş yap"}
          </button>
        </form>
      </section>
    </main>
  );
}
