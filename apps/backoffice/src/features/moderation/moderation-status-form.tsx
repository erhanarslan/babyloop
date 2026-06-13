"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useState } from "react";

import {
  type AdminModerationCaseDetail,
  type AdminModerationCaseStatus,
  updateAdminModerationCaseStatus,
} from "./api";

type ModerationStatusFormProps = {
  moderationCase: AdminModerationCaseDetail;
  onUpdated: (moderationCase: AdminModerationCaseDetail) => void;
};

const statusOptions: AdminModerationCaseStatus[] = [
  "pending",
  "in_review",
  "resolved",
  "dismissed",
];

export function ModerationStatusForm({
  moderationCase,
  onUpdated,
}: ModerationStatusFormProps) {
  const [selectedStatus, setSelectedStatus] =
    useState<AdminModerationCaseStatus>(moderationCase.status);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setFeedback(null);
    setErrorMessage(null);

    const trimmedNote = note.trim();
    const response = await updateAdminModerationCaseStatus(moderationCase.id, {
      status: selectedStatus,
      ...(trimmedNote ? { note: trimmedNote } : {}),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response, "Could not update status."));
      return;
    }

    onUpdated(response.data.case);
    setNote("");
    setFeedback("Status updated.");
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div>
        <h3>Update status</h3>
        <p>Change the moderation workflow state for this case.</p>
      </div>

      <label className="form-field">
        <span>Status</span>
        <select
          onChange={(event) =>
            setSelectedStatus(event.target.value as AdminModerationCaseStatus)
          }
          value={selectedStatus}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {getStatusLabel(status)}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Status note</span>
        <textarea
          maxLength={1000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional workflow note. Avoid unnecessary personal data."
          rows={3}
          value={note}
        />
      </label>

      {feedback ? <p className="form-success">{feedback}</p> : null}
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="primary-action"
        disabled={
          isSubmitting ||
          (selectedStatus === moderationCase.status && note.trim().length === 0)
        }
        type="submit"
      >
        {isSubmitting ? "Updating..." : "Update status"}
      </button>
    </form>
  );
}

function getStatusLabel(status: AdminModerationCaseStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "in_review":
      return "In review";
    case "resolved":
      return "Resolved";
    case "dismissed":
      return "Dismissed";
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
