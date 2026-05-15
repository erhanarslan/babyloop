"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { setAuthToken } from "../lib/auth-client";

type AuthMode = "login" | "register";

type AuthFormProps = {
  apiBaseUrl: string;
  mode: AuthMode;
};

type AuthPayload = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
  profile: {
    id: string;
    displayName: string;
    locationCity: string | null;
  };
};

export function AuthForm({ apiBaseUrl, mode }: AuthFormProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = getString(formData, "email");
    const password = getString(formData, "password");
    const displayName = getString(formData, "displayName");
    const locationCity = getString(formData, "locationCity");

    if (!email || !password || (isRegister && !displayName)) {
      setErrorMessage("Please complete the required fields.");
      return;
    }

    const payload = {
      email,
      password,
      ...(isRegister ? { displayName } : {}),
      ...(isRegister && locationCity ? { locationCity } : {})
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/${mode}`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as ApiResponse<AuthPayload>;

      if (!response.ok || !body.ok) {
        setErrorMessage(body.ok ? "Authentication failed." : body.error.message);
        return;
      }

      setAuthToken(body.data.accessToken);
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
      <div className="form-grid">
        <label className="form-field form-field-wide">
          <span>Email</span>
          <input name="email" type="email" maxLength={320} required />
        </label>

        <label className="form-field form-field-wide">
          <span>Password</span>
          <input name="password" type="password" minLength={8} maxLength={128} required />
        </label>

        {isRegister ? (
          <>
            <label className="form-field form-field-wide">
              <span>Display name</span>
              <input name="displayName" type="text" minLength={2} maxLength={120} required />
            </label>
            <label className="form-field form-field-wide">
              <span>City</span>
              <input name="locationCity" type="text" maxLength={120} />
            </label>
          </>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="form-actions">
        <p className="form-note">
          {isRegister ? "Creates a user and marketplace profile." : "Uses your BabyLoop token."}
        </p>
        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : isRegister ? "Create account" : "Login"}
        </button>
      </div>
    </form>
  );
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
