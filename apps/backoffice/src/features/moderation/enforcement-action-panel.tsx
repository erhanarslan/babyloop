"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  type AdminModerationCaseDetail,
  type AdminModerationEnforcementAction,
  applyAdminModerationEnforcement,
} from "./api";

type EnforcementActionPanelProps = {
  moderationCase: AdminModerationCaseDetail;
  onApplied: (moderationCase: AdminModerationCaseDetail) => void;
};

type EnforcementOption = {
  action: AdminModerationEnforcementAction;
  label: string;
  description: string;
};

const listingOptions: EnforcementOption[] = [
  {
    action: "listing_hide",
    label: "Hide listing",
    description: "Archive the listing so it is no longer publicly browsable.",
  },
  {
    action: "listing_restore",
    label: "Restore listing",
    description: "Return the listing to active status when enforcement is reversed.",
  },
];

const messageOptions: EnforcementOption[] = [
  {
    action: "message_hide",
    label: "Hide message",
    description: "Mark the message hidden using the existing deleted-at state.",
  },
  {
    action: "message_mark_reviewed",
    label: "Mark message reviewed",
    description: "Record a reviewed moderation action without changing message text.",
  },
];

export function EnforcementActionPanel({
  moderationCase,
  onApplied,
}: EnforcementActionPanelProps) {
  const options = useMemo(
    () => getEnforcementOptions(moderationCase.subjectType),
    [moderationCase.subjectType],
  );
  const [selectedAction, setSelectedAction] =
    useState<AdminModerationEnforcementAction | null>(
      options[0]?.action ?? null,
    );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAction(options[0]?.action ?? null);
    setReason("");
    setFeedback(null);
    setErrorMessage(null);
  }, [options]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedReason = reason.trim();

    if (!selectedAction) {
      setErrorMessage("No enforcement action is available for this case.");
      return;
    }

    if (trimmedReason.length < 10) {
      setErrorMessage("Enter a reason with at least 10 characters.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setErrorMessage(null);

    const response = await applyAdminModerationEnforcement(moderationCase.id, {
      action: selectedAction,
      reason: trimmedReason,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response, "Could not apply enforcement."));
      return;
    }

    onApplied(response.data.case);
    setReason("");
    setFeedback(
      `Enforcement applied. Audit event id: ${response.data.enforcement.auditEventId}`,
    );
  }

  return (
    <form className="form-card enforcement-card" onSubmit={handleSubmit}>
      <div>
        <h3>Enforcement actions</h3>
        <p>
          Use enforcement only when the case requires changing the target&apos;s
          moderation state. A reason is required and the action will be audited.
        </p>
      </div>

      {options.length === 0 ? (
        <div className="state-panel">
          No automated enforcement action is available for this target type yet.
        </div>
      ) : (
        <>
          <fieldset className="checkbox-group">
            <legend>Action</legend>
            {options.map((option) => (
              <label className="checkbox-option" key={option.action}>
                <input
                  checked={selectedAction === option.action}
                  disabled={isSubmitting}
                  name="enforcement-action"
                  onChange={() => setSelectedAction(option.action)}
                  type="radio"
                  value={option.action}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="form-field">
            <span>Enforcement reason</span>
            <textarea
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this enforcement action is necessary. Avoid unnecessary personal data."
              rows={4}
              value={reason}
            />
          </label>

          <div className="state-panel warning">
            This action changes moderation state and creates an audit/timeline
            event. It does not request or reveal sensitive raw data.
          </div>
        </>
      )}

      {feedback ? <p className="form-success">{feedback}</p> : null}
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="primary-action"
        disabled={isSubmitting || !selectedAction || reason.trim().length < 10}
        type="submit"
      >
        {isSubmitting ? "Applying..." : "Apply enforcement action"}
      </button>
    </form>
  );
}

function getEnforcementOptions(targetType: string): EnforcementOption[] {
  if (targetType === "listing") {
    return listingOptions;
  }

  if (targetType === "message") {
    return messageOptions;
  }

  return [];
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
