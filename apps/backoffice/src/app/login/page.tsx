"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "../../lib/api";
import { loginBackoffice } from "../../lib/auth-client";
import { resolveSafeBackofficeNextPath } from "../../lib/safe-next-path";

export default function BackofficeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submitInFlightRef = useRef(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

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

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">BabyLoop Backoffice</p>
        <h1>Sign in</h1>
        <p>
          Use an admin account to access moderation, trust and safety, support,
          audit, and AI-assisted operations.
        </p>

        <form aria-busy={isSubmitting} className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
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
            <span>Password</span>
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

          <button className="primary-action" disabled={isSubmitting || retryAfterSeconds > 0} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
