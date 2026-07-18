"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useMemo, useState } from "react";

import {
  applyAdminListingAction,
  type AdminListingAction,
  type AdminListingDetail,
} from "./api";

type ListingPublicationReviewPanelProps = {
  listing: AdminListingDetail;
  onApplied: (listing: AdminListingDetail) => void;
};

const MIN_REASON_LENGTH = 10;

export function ListingPublicationReviewPanel({
  listing,
  onApplied,
}: ListingPublicationReviewPanelProps) {
  const supportedActions = useMemo(
    () =>
      listing.actionEligibility.supportedActions.filter(
        (action): action is Extract<AdminListingAction, "publish" | "request_changes"> =>
          action === "publish" || action === "request_changes",
      ),
    [listing.actionEligibility.supportedActions],
  );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setReason("");
    setIsSubmitting(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [listing.id, listing.publicationState]);

  const approvedImageCount = listing.images.filter(
    (image) => image.reviewStatus === "approved",
  ).length;
  const blockingImageCount = listing.images.filter(
    (image) => image.reviewStatus === "pending" || image.reviewStatus === "needs_review",
  ).length;
  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH && !isSubmitting;

  async function applyAction(action: Extract<AdminListingAction, "publish" | "request_changes">) {
    if (!canSubmit || !supportedActions.includes(action)) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await applyAdminListingAction(listing.id, {
      action,
      reason: reason.trim(),
    });

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response, "Yayın inceleme kararı uygulanamadı."));
      setIsSubmitting(false);
      return;
    }

    onApplied(response.data.listing);
    setReason("");
    setSuccessMessage(
      action === "publish"
        ? "İlan yayınlandı ve karar audit kaydına işlendi."
        : "Düzeltme isteği kullanıcıya iletildi ve audit kaydına işlendi.",
    );
    setIsSubmitting(false);
  }

  return (
    <section className="form-card publication-review-panel" data-admin-publication-review={listing.id}>
      <div>
        <p className="eyebrow">Yayın incelemesi</p>
        <h3>İlan yayın kararı</h3>
        <p>
          İlan bilgilerini ve AI görsel sinyallerini birlikte değerlendir. Görsel onayı ile ilan
          yayın kararı birbirinden ayrıdır.
        </p>
      </div>

      <dl className="compact-details publication-review-facts">
        <div>
          <dt>Yayın durumu</dt>
          <dd>{getPublicationStateLabel(listing.publicationState)}</dd>
        </div>
        <div>
          <dt>Onaylı görsel</dt>
          <dd>{approvedImageCount}</dd>
        </div>
        <div>
          <dt>İnceleme bekleyen görsel</dt>
          <dd>{blockingImageCount}</dd>
        </div>
        <div>
          <dt>Planlanan yayın</dt>
          <dd>{listing.publishAfter ? formatDateTime(listing.publishAfter) : "—"}</dd>
        </div>
      </dl>

      {listing.publicationReviewReason ? (
        <div className="state-panel warning">
          <strong>Son düzeltme gerekçesi</strong>
          <p>{listing.publicationReviewReason}</p>
        </div>
      ) : null}

      {supportedActions.length === 0 ? (
        <div className="state-panel">
          <strong>Yayın kararı için hazır değil</strong>
          <p>
            Görsel kontrolü tamamlandıktan veya ilan yeniden onaya gönderildikten sonra aksiyonlar
            açılır.
          </p>
        </div>
      ) : (
        <div className="sensitive-access-form">
          <label className="form-field">
            <span>Karar gerekçesi</span>
            <textarea
              minLength={MIN_REASON_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Kararı açıklayan en az 10 karakterlik kısa not."
              rows={4}
              value={reason}
            />
          </label>

          <div className="publication-review-actions">
            {supportedActions.includes("publish") ? (
              <button
                className="primary-action"
                disabled={!canSubmit}
                onClick={() => {
                  void applyAction("publish");
                }}
                type="button"
              >
                {isSubmitting ? "Uygulanıyor..." : "İlanı yayınla"}
              </button>
            ) : null}

            {supportedActions.includes("request_changes") ? (
              <button
                className="secondary-action danger-outline"
                disabled={!canSubmit}
                onClick={() => {
                  void applyAction("request_changes");
                }}
                type="button"
              >
                {isSubmitting ? "Uygulanıyor..." : "Düzeltme iste"}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? <p className="form-success">{successMessage}</p> : null}
    </section>
  );
}

function getPublicationStateLabel(state: AdminListingDetail["publicationState"]): string {
  switch (state) {
    case "awaiting_images":
      return "Görsel bekliyor";
    case "ai_review":
      return "AI / görsel incelemesi";
    case "admin_review":
      return "Admin onayı bekliyor";
    case "scheduled":
      return "Otomatik yayın sırasına alındı";
    case "published":
      return "Yayında";
    case "changes_requested":
      return "Düzeltme istendi";
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR");
}

function getApiErrorMessage(response: ApiResponse<unknown>, fallback: string): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.message ?? fallback;
}
