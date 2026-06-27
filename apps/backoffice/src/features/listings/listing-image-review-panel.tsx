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
        <p className="eyebrow">Images</p>
        <h3>Image review</h3>
        <p>
          Approve or reject individual listing images. Images marked needs review
          stay visible to admins but are hidden from public listing responses until approved.
        </p>
      </div>

      {needsReviewCount > 0 ? (
        <div className="state-panel">
          <strong>{needsReviewCount} images awaiting review in this listing</strong>
          <p>Review queue images are hidden publicly until approved.</p>
        </div>
      ) : null}

      {images.length === 0 ? (
        <div className="state-panel">This listing has no uploaded images.</div>
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
            <strong>Hidden publicly until approved</strong>
            <p>This image is visible to admins only while it is awaiting review.</p>
          </div>
        ) : null}
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
        <div>
          <dt>AI decision</dt>
          <dd>{image.authenticity.decision ?? "Not checked"}</dd>
        </div>
        <div>
          <dt>AI confidence</dt>
          <dd>{image.authenticity.confidence === null ? "Not set" : image.authenticity.confidence.toFixed(2)}</dd>
        </div>
        <div>
          <dt>AI provider</dt>
          <dd>{image.authenticity.providerName ?? "Not set"}</dd>
        </div>
        <div>
          <dt>AI model</dt>
          <dd>{image.authenticity.modelName ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Prompt version</dt>
          <dd>{image.authenticity.promptVersion ?? "Not set"}</dd>
        </div>
        <div>
          <dt>AI checked</dt>
          <dd>{image.authenticity.checkedAt ? formatDateTime(image.authenticity.checkedAt) : "Not checked"}</dd>
        </div>
        <div className="full-field">
          <dt>AI reasons</dt>
          <dd>{image.authenticity.reasons.length > 0 ? image.authenticity.reasons.join(" / ") : "No AI reason recorded."}</dd>
        </div>
        <div className="full-field">
          <dt>AI flags</dt>
          <dd>{formatAuthenticityFlags(image.authenticity.flags)}</dd>
        </div>
        <div className="full-field">
          <dt>Image ID</dt>
          <dd>{image.id}</dd>
        </div>
      </dl>

      <form
        className="sensitive-access-form"
        data-admin-image-review-form={image.id}
        onSubmit={handleSubmit}
      >
        <label className="form-field">
          <span>Review action</span>
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
          <span>Review reason</span>
          <textarea
            data-admin-image-review-reason={image.id}
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

        <button
          className="primary-action"
          data-admin-image-review-submit={image.id}
          disabled={!canSubmit}
          type="submit"
        >
          {isSubmitting ? "Applying..." : "Apply image review"}
        </button>
      </form>
    </article>
  );
}

function getReviewActionLabel(action: AdminListingImageAction): string {
  switch (action) {
    case "approve":
      return "Approve image";
    case "reject":
      return "Reject image";
  }
}

function getReviewStatusLabel(status: AdminListingImage["reviewStatus"]): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "needs_review":
      return "Needs review";
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

function formatAuthenticityFlags(flags: Record<string, unknown>): string {
  const entries = Object.entries(flags);

  if (entries.length === 0) {
    return "No AI flags recorded.";
  }

  return JSON.stringify(flags);
}
