"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, EmptyState, TextInput } from "../../components/ui";
import { confirmPasswordReset } from "./api";

type ResetPasswordFormProps = {
  apiBaseUrl: string;
};

export function ResetPasswordForm({ apiBaseUrl }: ResetPasswordFormProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasReset, setWasReset] = useState(false);

  if (!token) {
    return (
      <EmptyState
        title="Reset token missing"
        message="Open the reset link generated for your account, or request a new password reset."
        actionHref="/forgot-password"
        actionLabel="Request password reset"
      />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const newPassword = getString(formData, "newPassword");
    const confirmPassword = getString(formData, "confirmPassword");

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const body = await confirmPasswordReset(apiBaseUrl, token, newPassword);

      if (!body.ok) {
        setErrorMessage(body.error.message);
        return;
      }

      setWasReset(true);
    } catch {
      setErrorMessage("BabyLoop API is unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (wasReset) {
    return (
      <div className="listing-form">
        <Alert
          tone="info"
          title="Password reset"
          message="Your password was changed. You can now login with the new password."
        />
        <Link className="primary-link" href="/login">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form className="listing-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <TextInput
          label="New password"
          name="newPassword"
          type="password"
          minLength={8}
          maxLength={128}
          required
          wide
        />
        <TextInput
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          minLength={8}
          maxLength={128}
          required
          wide
        />
      </div>

      {errorMessage ? <Alert title="Password reset failed" message={errorMessage} /> : null}

      <div className="form-actions">
        <p className="form-note">Reset tokens are single-use and expire after a short time.</p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Changing..." : "Change password"}
        </Button>
      </div>
    </form>
  );
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
