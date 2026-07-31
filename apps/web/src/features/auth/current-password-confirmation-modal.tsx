"use client";

import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Button, TextInput } from "../../components/ui";
import { useBodyScrollLock } from "../../lib/body-scroll-lock";

type CurrentPasswordConfirmationModalProps = {
  description: string;
  errorMessage: string | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (currentPassword: string) => void;
  submitLabel: string;
  title: string;
};

export function CurrentPasswordConfirmationModal({
  description,
  errorMessage,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
  submitLabel,
  title
}: CurrentPasswordConfirmationModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  useBodyScrollLock(isOpen);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword("");
      setValidationMessage(null);
      return;
    }

    window.setTimeout(() => document.getElementById("current-password-confirmation-input")?.focus({ preventScroll: true }), 0);

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isMounted || !isOpen) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = currentPassword.trim();

    if (!password) {
      setValidationMessage("Mevcut şifreni gir.");
      return;
    }

    setValidationMessage(null);
    onConfirm(password);
  }

  return createPortal(
    <div
      className="password-change-modal-backdrop"
      role="presentation"
      onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="current-password-confirmation-title"
        aria-modal="true"
        className="password-change-modal-card max-w-md"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="password-change-modal-header">
          <div>
            <p className="eyebrow">Güvenlik doğrulaması</p>
            <h2 id="current-password-confirmation-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button
            aria-label="Pencereyi kapat"
            className="password-change-modal-close"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form className="password-change-modal-content grid gap-4" onSubmit={handleSubmit}>
          <TextInput
            autoComplete="current-password"
            disabled={isSubmitting}
            id="current-password-confirmation-input"
            label="Mevcut şifre"
            maxLength={128}
            type="password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              setValidationMessage(null);
            }}
            wide
          />

          {validationMessage || errorMessage ? (
            <p className="text-sm font-bold text-destructive" role="alert">
              {validationMessage ?? errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button disabled={isSubmitting} type="button" variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Doğrulanıyor…" : submitLabel}
            </Button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}
