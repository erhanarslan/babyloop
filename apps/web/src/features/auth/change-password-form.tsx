"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, TextInput } from "../../components/ui";
import { clearAuthToken, getAuthToken } from "../../lib/auth-client";
import { changePassword } from "./api";

type ChangePasswordFormProps = {
  apiBaseUrl: string;
};

export function ChangePasswordForm({ apiBaseUrl }: ChangePasswordFormProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!getAuthToken()) {
      setErrorMessage("Please login before changing your password.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const currentPassword = getString(formData, "currentPassword");
    const newPassword = getString(formData, "newPassword");
    const confirmPassword = getString(formData, "confirmPassword");

    if (!currentPassword) {
      setErrorMessage("Please enter your current password.");
      return;
    }

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
      const body = await changePassword(apiBaseUrl, currentPassword, newPassword);

      if (!body.ok) {
        setErrorMessage(body.error.message);
        return;
      }

      clearAuthToken();
      router.replace("/login?passwordChanged=1");
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
        <TextInput
          label="Current password"
          name="currentPassword"
          type="password"
          maxLength={128}
          required
          wide
        />
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

      {errorMessage ? <Alert title="Password change failed" message={errorMessage} /> : null}

      <div className="form-actions">
        <p className="form-note">Changing your password ends active refresh sessions.</p>
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
