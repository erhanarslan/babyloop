"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  type AdminListingAction,
  type AdminListingDetail,
  applyAdminListingAction,
} from "./api";

type ListingStatusAction = Extract<AdminListingAction, "archive" | "restore">;

type ListingStatusActionFormProps = {
  listing: AdminListingDetail;
  onApplied: (listing: AdminListingDetail) => void;
};

const MIN_REASON_LENGTH = 10;

export function ListingStatusActionForm({
  listing,
  onApplied,
}: ListingStatusActionFormProps) {
  const supportedActions = useMemo(
    () =>
      listing.actionEligibility.supportedActions.filter(
        (action): action is ListingStatusAction =>
          action === "archive" || action === "restore",
      ),
    [listing.actionEligibility.supportedActions],
  );
  const initialAction = supportedActions[0] ?? "archive";
  const [action, setAction] = useState<ListingStatusAction>(initialAction);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setAction(supportedActions[0] ?? "archive");
    setReason("");
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsSubmitting(false);
  }, [listing.id, listing.status, supportedActions]);

  const canSubmit =
    supportedActions.length > 0 &&
    reason.trim().length >= MIN_REASON_LENGTH &&
    !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const response = await applyAdminListingAction(listing.id, {
      action,
      reason: reason.trim(),
    });

    if (!response.ok) {
      setErrorMessage(
        getApiErrorMessage(response, "İlan işlemi uygulanamadı."),
      );
      setIsSubmitting(false);
      return;
    }

    onApplied(response.data.listing);
    setReason("");
    setSuccessMessage(`İşlem audit kaydına alındı: ${response.data.action.auditEventId}`);
    setIsSubmitting(false);
  }

  return (
    <section className="form-card">
      <div>
        <p className="eyebrow">İlan durumu</p>
        <h3>Durum kontrolleri</h3>
        <p>
          İlan kapsamındaki işlemler moderasyon vakası yaptırımlarından ayrıdır.
          Neden zorunludur ve her değişiklik denetlenir.
        </p>
      </div>

      {supportedActions.length === 0 ? (
        <div className="state-panel">
          Bu durum için desteklenen ilan işlemi yok.
        </div>
      ) : (
        <form className="sensitive-access-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>İşlem</span>
            <select
              onChange={(event) =>
                setAction(event.target.value as ListingStatusAction)
              }
              value={action}
            >
              {supportedActions.map((supportedAction) => (
                <option key={supportedAction} value={supportedAction}>
                  {getActionLabel(supportedAction)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>İşlem nedeni</span>
            <textarea
              minLength={MIN_REASON_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Bu ilan işleminin neden gerekli olduğunu açıkla."
              rows={4}
              value={reason}
            />
          </label>

          <div className="state-panel warning">
            Bu işlem pazar yeri ilan durumunu değiştirir. Vaka kapsamındaki kararlar
            için moderasyon vakası yaptırımını kullan.
          </div>

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? <p className="form-success">{successMessage}</p> : null}

          <button className="primary-action" disabled={!canSubmit} type="submit">
            {isSubmitting ? "Uygulanıyor…" : "İlan işlemini uygula"}
          </button>
        </form>
      )}
    </section>
  );
}

function getActionLabel(action: ListingStatusAction): string {
  switch (action) {
    case "archive":
      return "İlanı arşivle";
    case "restore":
      return "İlanı geri yükle";
  }
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.code === "FORBIDDEN"
    ? "İlan durumunu değiştirme yetkin yok."
    : fallback;
}
