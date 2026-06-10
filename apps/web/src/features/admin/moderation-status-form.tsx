"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { getApiErrorMessage } from "../../lib/api-error-message";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";
import {
  updateAdminModerationCaseStatus,
  type AdminModerationCaseDetail,
  type AdminModerationCaseStatus,
} from "./api";

type ModerationStatusFormProps = {
  caseId: string;
  currentStatus: AdminModerationCaseStatus;
  onUpdated: (moderationCase: AdminModerationCaseDetail) => void;
};

const STATUS_OPTIONS: AdminModerationCaseStatus[] = [
  "pending",
  "in_review",
  "resolved",
  "dismissed",
];

export function ModerationStatusForm({
  caseId,
  currentStatus,
  onUpdated,
}: ModerationStatusFormProps) {
  const { dictionary } = useI18n();
  const [selectedStatus, setSelectedStatus] =
    useState<AdminModerationCaseStatus>(currentStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<
    | {
        type: "success";
        message: string;
      }
    | {
        type: "error";
        message: string;
      }
    | null
  >(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setFeedback(null);

    const response = await updateAdminModerationCaseStatus(caseId, {
      status: selectedStatus,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: getApiErrorMessage(response.error, dictionary),
      });
      return;
    }

    onUpdated(response.data.case);
    setFeedback({
      type: "success",
      message: dictionary.admin.moderation.statusUpdated,
    });
  }

  return (
    <form
      className="grid gap-3 rounded-lg border border-border bg-card/80 p-6"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-1">
        <h2>{dictionary.admin.moderation.updateStatusTitle}</h2>
        <p>{dictionary.admin.moderation.updateStatusDescription}</p>
      </div>

      <label className="grid gap-2">
        <span>{dictionary.admin.moderation.status}</span>
        <select
          value={selectedStatus}
          onChange={(event) =>
            setSelectedStatus(event.target.value as AdminModerationCaseStatus)
          }
          disabled={isSubmitting}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {getCaseStatusLabel(status, dictionary)}
            </option>
          ))}
        </select>
      </label>

      {feedback ? (
        <p role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </p>
      ) : null}

      <div>
        <button
          className="primary-link"
          type="submit"
          disabled={isSubmitting || selectedStatus === currentStatus}
        >
          {isSubmitting
            ? dictionary.admin.moderation.updating
            : dictionary.admin.moderation.updateStatus}
        </button>
      </div>
    </form>
  );
}

function getCaseStatusLabel(
  status: AdminModerationCaseStatus,
  dictionary: Dictionary,
): string {
  switch (status) {
    case "pending":
      return dictionary.admin.moderation.pending;
    case "in_review":
      return dictionary.admin.moderation.inReview;
    case "resolved":
      return dictionary.admin.moderation.resolved;
    case "dismissed":
      return dictionary.admin.moderation.dismissed;
  }
}