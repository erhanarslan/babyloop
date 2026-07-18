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
        getApiErrorMessage(response, "Could not apply listing action."),
      );
      setIsSubmitting(false);
      return;
    }

    onApplied(response.data.listing);
    setReason("");
    setSuccessMessage(`Action audited: ${response.data.action.auditEventId}`);
    setIsSubmitting(false);
  }

  return (
    <section className="form-card">
      <div>
        <p className="eyebrow">Listing status</p>
        <h3>Status controls</h3>
        <p>
          Listing-scoped actions are separate from moderation case enforcement.
          A reason is required and every change is audited.
        </p>
      </div>

      {supportedActions.length === 0 ? (
        <div className="state-panel">
          No supported listing actions are available for this status.
        </div>
      ) : (
        <form className="sensitive-access-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Action</span>
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
            <span>Action reason</span>
            <textarea
              minLength={MIN_REASON_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this listing action is necessary."
              rows={4}
              value={reason}
            />
          </label>

          <div className="state-panel warning">
            This changes the marketplace listing status. Use moderation case
            enforcement for case-scoped decisions.
          </div>

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? <p className="form-success">{successMessage}</p> : null}

          <button className="primary-action" disabled={!canSubmit} type="submit">
            {isSubmitting ? "Applying..." : "Apply listing action"}
          </button>
        </form>
      )}
    </section>
  );
}

function getActionLabel(action: ListingStatusAction): string {
  switch (action) {
    case "archive":
      return "Archive listing";
    case "restore":
      return "Restore listing";
  }
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
