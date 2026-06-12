"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useState } from "react";

import {
  type AdminListingDetail,
  type AdminListingImage,
  type AdminListingImageAction,
  applyAdminListingImageAction,
} from "./api";

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
  return (
    <section className="form-card">
      <div>
        <p className="eyebrow">Images</p>
        <h3>Image review</h3>
        <p>
          Approve or reject individual listing images. Rejected images stay
          visible to admins but are hidden from public listing responses.
        </p>
      </div>

      {images.length === 0 ? (
        <div className="state-panel">This listing has no uploaded images.</div>
      ) : (
        <div className="image-review-grid">
          {images.map((image) => (
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
  const [action, setAction] = useState<AdminListingImageAction>(
    image.reviewStatus === "rejected" ? "approve" : "reject",
  );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH && !isSubmitting;

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
      setErrorMessage(getApiErrorMessage(response, "Could not review image."));
      setIsSubmitting(false);
      return;
    }

    onReviewed(response.data.listing);
    setReason("");
    setSuccessMessage(`Image review audited: ${response.data.auditEventId}`);
    setIsSubmitting(false);
  }

  return (
    <article className="image-review-card">
      <img alt="" src={image.url} />
      <div className="case-card-header">
        <span className={`status-badge ${image.reviewStatus}`}>
          {getReviewStatusLabel(image.reviewStatus)}
        </span>
      </div>

      <dl className="compact-details">
        <div>
          <dt>Sort order</dt>
          <dd>{image.sortOrder}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(image.createdAt)}</dd>
        </div>
        <div>
          <dt>Reviewed</dt>
          <dd>{image.reviewedAt ? formatDateTime(image.reviewedAt) : "Not reviewed"}</dd>
        </div>
        <div>
          <dt>Reviewer</dt>
          <dd>{image.reviewedByProfileId ?? "Not set"}</dd>
        </div>
        <div className="full-field">
          <dt>Image ID</dt>
          <dd>{image.id}</dd>
        </div>
      </dl>

      <form className="sensitive-access-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Review action</span>
          <select
            onChange={(event) =>
              setAction(event.target.value as AdminListingImageAction)
            }
            value={action}
          >
            <option value="approve">Approve image</option>
            <option value="reject">Reject image</option>
          </select>
        </label>

        <label className="form-field">
          <span>Review reason</span>
          <textarea
            minLength={MIN_REASON_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this image review action is needed."
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

        <button className="primary-action" disabled={!canSubmit} type="submit">
          {isSubmitting ? "Applying..." : "Apply image review"}
        </button>
      </form>
    </article>
  );
}

function getReviewStatusLabel(status: AdminListingImage["reviewStatus"]): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.message ?? fallback;
}
