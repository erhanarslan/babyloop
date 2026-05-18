"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button } from "../../components/ui";
import { setAuthToken } from "../../lib/auth-client";
import { AuthFields } from "./auth-fields";
import { submitAuthRequest, type AuthMode } from "./api";

type AuthFormProps = {
  apiBaseUrl: string;
  mode: AuthMode;
};

export function AuthForm({ apiBaseUrl, mode }: AuthFormProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

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
      <AuthFields mode={mode} />

      {errorMessage ? (
        <Alert title="Account request failed" message={errorMessage} />
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
