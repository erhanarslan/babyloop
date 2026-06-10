"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { getApiErrorMessage } from "../../lib/api-error-message";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";
import {
  createAdminModerationCaseAction,
  type AdminModerationActionType,
  type AdminModerationCaseDetail,
} from "./api";

type ModerationActionFormProps = {
  caseId: string;
  onCreated: (moderationCase: AdminModerationCaseDetail) => void;
};

const ACTION_OPTIONS: AdminModerationActionType[] = [
  "note",
  "review_started",
  "dismissed",
  "resolved",
  "action_taken",
];

export function ModerationActionForm({
  caseId,
  onCreated,
}: ModerationActionFormProps) {
  const { dictionary } = useI18n();
  const [actionType, setActionType] =
    useState<AdminModerationActionType>("note");
  const [note, setNote] = useState("");
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

    const trimmedNote = note.trim();

    if (!trimmedNote) {
      setFeedback({
        type: "error",
        message: dictionary.admin.moderation.adminNoteRequired,
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const response = await createAdminModerationCaseAction(caseId, {
      type: actionType,
      note: trimmedNote,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: getApiErrorMessage(response.error, dictionary),
      });
      return;
    }

    onCreated(response.data.case);
    setNote("");
    setActionType("note");
    setFeedback({
      type: "success",
      message: dictionary.admin.moderation.actionAdded,
    });
  }

  return (
    <form
      className="grid gap-3 rounded-lg border border-border bg-card/80 p-6"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-1">
        <h2>{dictionary.admin.moderation.addActionTitle}</h2>
        <p>{dictionary.admin.moderation.addActionDescription}</p>
      </div>

      <label className="grid gap-2">
        <span>{dictionary.admin.moderation.actionType}</span>
        <select
          value={actionType}
          onChange={(event) =>
            setActionType(event.target.value as AdminModerationActionType)
          }
          disabled={isSubmitting}
        >
          {ACTION_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {getActionTypeLabel(type, dictionary)}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span>{dictionary.admin.moderation.adminNote}</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={isSubmitting}
          rows={4}
          maxLength={1000}
          placeholder={dictionary.admin.moderation.adminNotePlaceholder}
        />
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
          disabled={isSubmitting || !note.trim()}
        >
          {isSubmitting
            ? dictionary.admin.moderation.adding
            : dictionary.admin.moderation.addAction}
        </button>
      </div>
    </form>
  );
}

function getActionTypeLabel(
  type: AdminModerationActionType,
  dictionary: Dictionary,
): string {
  switch (type) {
    case "note":
      return dictionary.admin.moderation.note;
    case "review_started":
      return dictionary.admin.moderation.reviewStarted;
    case "dismissed":
      return dictionary.admin.moderation.dismissed;
    case "resolved":
      return dictionary.admin.moderation.resolved;
    case "action_taken":
      return dictionary.admin.moderation.actionTaken;
  }
}