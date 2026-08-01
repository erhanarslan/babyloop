"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  type AdminListingDetail,
  type AdminListingImage,
  type AdminListingImageAction,
  applyAdminListingImageAction,
} from "./api";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

type ListingImageReviewPanelProps = {
  listingId: string;
  images: AdminListingImage[];
  onReviewed: (listing: AdminListingDetail) => void;
};

const MIN_REASON_LENGTH = 10;

export function ListingImageReviewPanel({
  images,
  listingId,
  onReviewed,
}: ListingImageReviewPanelProps) {
  const sortedImages = [...images].sort(
    (left, right) =>
      getImageReviewPriority(left.reviewStatus) - getImageReviewPriority(right.reviewStatus) ||
      left.sortOrder - right.sortOrder,
  );
  const needsReviewCount = images.filter((image) => image.reviewStatus === "needs_review").length;

  return (
    <section className="form-card">
      <div>
        <p className="eyebrow">Görseller</p>
        <h3>Görsel incelemesi</h3>
        <p>
          İlan görsellerini tek tek onayla veya reddet. İnceleme gereken görseller
          yöneticilere görünür, onaylanana kadar herkese açık ilan yanıtlarında gizlenir.
        </p>
      </div>

      {needsReviewCount > 0 ? (
        <div className="state-panel">
          <strong>Bu ilanda {needsReviewCount} görsel inceleme bekliyor</strong>
          <p>İnceleme kuyruğundaki görseller onaylanana kadar herkese açık görünmez.</p>
        </div>
      ) : null}

      {images.length === 0 ? (
        <div className="state-panel">Bu ilana yüklenmiş görsel yok.</div>
      ) : (
        <div className="image-review-grid">
          {sortedImages.map((image) => (
            <ImageReviewCard
              image={image}
              key={image.id}
              listingId={listingId}
              onReviewed={onReviewed}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ImageReviewCard({
  image,
  listingId,
  onReviewed,
}: {
  image: AdminListingImage;
  listingId: string;
  onReviewed: (listing: AdminListingDetail) => void;
}) {
  const supportedActions = useMemo<AdminListingImageAction[]>(
    () => {
      if (image.reviewStatus === "approved") {
        return ["reject"];
      }

      if (image.reviewStatus === "rejected") {
        return ["approve"];
      }

      return ["approve", "reject"];
    },
    [image.reviewStatus],
  );
  const [action, setAction] = useState<AdminListingImageAction>(
    supportedActions[0] ?? "reject",
  );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH && !isSubmitting;

  useEffect(() => {
    setAction(supportedActions[0] ?? "reject");
    setReason("");
    setErrorMessage(null);
    setIsSubmitting(false);
  }, [image.id, image.reviewStatus, listingId, supportedActions]);

  useEffect(() => {
    setSuccessMessage(null);
  }, [image.id, listingId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const response = await applyAdminListingImageAction(listingId, image.id, {
      action,
      reason: reason.trim(),
    });

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response, "Görsel incelenemedi."));
      setIsSubmitting(false);
      return;
    }

    onReviewed(response.data.listing);
    setReason("");
    setSuccessMessage(`Görsel incelemesi denetlendi: ${response.data.auditEventId}`);
    setIsSubmitting(false);
  }

  return (
    <article
      className="image-review-card"
      data-admin-image-id={image.id}
      data-admin-image-review-status={image.reviewStatus}
    >
      <img alt="" src={image.url} />
      <div className="case-card-header">
        <span
          className={`status-badge ${image.reviewStatus}`}
          data-admin-image-review-status-label={image.reviewStatus}
        >
          {getReviewStatusLabel(image.reviewStatus)}
        </span>
        {image.reviewStatus === "needs_review" ? (
          <div className="state-panel">
            <strong>Onaylanana kadar herkese açık görünmez</strong>
            <p>Bu görsel inceleme beklerken yalnız yöneticilere görünür.</p>
          </div>
        ) : null}
      </div>

      <dl className="compact-details">
        <div>
          <dt>Sıralama</dt>
          <dd>{image.sortOrder}</dd>
        </div>
        <div>
          <dt>Oluşturulma</dt>
          <dd>{formatDateTime(image.createdAt)}</dd>
        </div>
        <div>
          <dt>İncelenme</dt>
          <dd>{image.reviewedAt ? formatDateTime(image.reviewedAt) : "İncelenmedi"}</dd>
        </div>
        <div>
          <dt>İnceleyen</dt>
          <dd>{image.reviewedByProfileId ?? "Belirtilmedi"}</dd>
        </div>
        <div>
          <dt>AI kararı</dt>
          <dd>{formatEnumLabel(image.authenticity.decision ?? "unknown")}</dd>
        </div>
        <div>
          <dt>AI güveni</dt>
          <dd>{image.authenticity.confidence === null ? "Belirtilmedi" : image.authenticity.confidence.toFixed(2)}</dd>
        </div>
        <div>
          <dt>AI sağlayıcısı</dt>
          <dd>{image.authenticity.providerName ?? "Belirtilmedi"}</dd>
        </div>
        <div>
          <dt>AI model</dt>
          <dd>{image.authenticity.modelName ?? "Belirtilmedi"}</dd>
        </div>
        <div>
          <dt>İstem sürümü</dt>
          <dd>{image.authenticity.promptVersion ?? "Belirtilmedi"}</dd>
        </div>
        <div>
          <dt>AI kontrol zamanı</dt>
          <dd>{image.authenticity.checkedAt ? formatDateTime(image.authenticity.checkedAt) : "Kontrol edilmedi"}</dd>
        </div>
        <div className="full-field">
          <dt>AI nedenleri</dt>
          <dd>{image.authenticity.reasons.length > 0 ? image.authenticity.reasons.join(" / ") : "AI nedeni kaydedilmedi."}</dd>
        </div>
        <div className="full-field">
          <dt>AI işaretleri</dt>
          <dd>{formatAuthenticityFlags(image.authenticity.flags)}</dd>
        </div>
        <div className="full-field">
          <dt>Görsel kimliği</dt>
          <dd>{image.id}</dd>
        </div>
      </dl>

      <form
        className="sensitive-access-form"
        data-admin-image-review-form={image.id}
        onSubmit={handleSubmit}
      >
        <label className="form-field">
          <span>İnceleme işlemi</span>
          <select
            data-admin-image-review-action={image.id}
            onChange={(event) =>
              setAction(event.target.value as AdminListingImageAction)
            }
            value={action}
          >
            {supportedActions.map((supportedAction) => (
              <option key={supportedAction} value={supportedAction}>
                {getReviewActionLabel(supportedAction)}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>İnceleme nedeni</span>
          <textarea
            data-admin-image-review-reason={image.id}
            minLength={MIN_REASON_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Bu görsel inceleme işleminin neden gerekli olduğunu açıkla."
            rows={3}
            value={reason}
          />
        </label>

        {errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? <p className="form-success">{successMessage}</p> : null}

        <button
          className="primary-action"
          data-admin-image-review-submit={image.id}
          disabled={!canSubmit}
          type="submit"
        >
          {isSubmitting ? "Uygulanıyor…" : "Görsel incelemesini uygula"}
        </button>
      </form>
    </article>
  );
}

function getReviewActionLabel(action: AdminListingImageAction): string {
  switch (action) {
    case "approve":
      return "Görseli onayla";
    case "reject":
      return "Görseli reddet";
  }
}

function getReviewStatusLabel(status: AdminListingImage["reviewStatus"]): string {
  switch (status) {
    case "pending":
      return "Bekliyor";
    case "approved":
      return "Onaylandı";
    case "needs_review":
      return "İnceleme gerekli";
    case "rejected":
      return "Reddedildi";
  }
}

function formatDateTime(value: string): string {
  return formatDateTimeTr(value);
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.code === "FORBIDDEN"
    ? "Görsel incelemesi yapma yetkin yok."
    : fallback;
}

function getImageReviewPriority(status: AdminListingImage["reviewStatus"]): number {
  switch (status) {
    case "needs_review":
      return 0;
    case "pending":
      return 1;
    case "rejected":
      return 2;
    case "approved":
      return 3;
  }
}


const SENSITIVE_IMAGE_REVIEW_METADATA_KEY_PARTS = [
  "authorization",
  "cookie",
  "credential",
  "email",
  "message",
  "password",
  "phone",
  "prompt",
  "raw",
  "refresh",
  "secret",
  "session",
  "token"
];

function formatAuthenticityFlags(flags: Record<string, unknown>): string {
  const safeFlags = sanitizeImageReviewMetadata(flags);

  return Object.keys(safeFlags).length > 0
    ? JSON.stringify(safeFlags)
    : "Güvenli AI işareti kaydedilmedi.";
}

function sanitizeImageReviewMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const safeMetadata: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (isSensitiveImageReviewMetadataKey(key)) {
      continue;
    }

    const safeValue = sanitizeImageReviewMetadataValue(entryValue);

    if (safeValue !== undefined) {
      safeMetadata[key] = safeValue;
    }
  }

  return safeMetadata;
}

function sanitizeImageReviewMetadataValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return isSensitiveImageReviewMetadataString(value) ? "[redacted]" : value;
  }

  if (Array.isArray(value)) {
    return value
      .map(sanitizeImageReviewMetadataValue)
      .filter((item): item is Exclude<unknown, undefined> => item !== undefined);
  }

  if (typeof value === "object") {
    return sanitizeImageReviewMetadata(value);
  }

  return undefined;
}

function isSensitiveImageReviewMetadataKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return SENSITIVE_IMAGE_REVIEW_METADATA_KEY_PARTS.some((part) =>
    normalizedKey.includes(part)
  );
}

function isSensitiveImageReviewMetadataString(value: string): boolean {
  const normalizedValue = value.toLowerCase();

  return (
    normalizedValue.includes("sk-") ||
    normalizedValue.includes("bearer ") ||
    normalizedValue.includes("authorization:") ||
    normalizedValue.includes("access_token") ||
    normalizedValue.includes("refresh_token")
  );
}
