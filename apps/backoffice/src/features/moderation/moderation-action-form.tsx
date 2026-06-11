"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useState } from "react";

import {
  type AdminModerationActionType,
  type AdminModerationCaseDetail,
  createAdminModerationCaseAction,
} from "./api";

type ModerationActionFormProps = {
  moderationCase: AdminModerationCaseDetail;
  onCreated: (moderationCase: AdminModerationCaseDetail) => void;
};

const actionOptions: AdminModerationActionType[] = [
  "note",
  "review_started",
  "dismissed",
  "resolved",
  "action_taken",
];

export function ModerationActionForm({
  moderationCase,
  onCreated,
}: ModerationActionFormProps) {
  const [actionType, setActionType] = useState<AdminModerationActionType>("note");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedNote = note.trim();

    if (!trimmedNote) {
      setErrorMessage("Admin note is required.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setErrorMessage(null);

    const response = await createAdminModerationCaseAction(moderationCase.id, {
      type: actionType,
      note: trimmedNote,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response, "Could not add action."));
      return;
    }

    onCreated(response.data.case);
    setNote("");
    setActionType("note");
    setFeedback("Action added.");
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div>
        <h3>Add note/action</h3>
        <p>
          Add an internal moderation note or workflow action. Use the
          enforcement panel for audited listing or message state changes.
        </p>
      </div>

      <label className="form-field">
        <span>Action type</span>
        <select
          onChange={(event) =>
            setActionType(event.target.value as AdminModerationActionType)
          }
          value={actionType}
        >
          {actionOptions.map((type) => (
            <option key={type} value={type}>
              {getActionTypeLabel(type)}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Admin note</span>
        <textarea
          onChange={(event) => setNote(event.target.value)}
          placeholder="Write a clear moderation note. Do not include unnecessary personal data."
          rows={5}
          value={note}
        />
      </label>

      {feedback ? <p className="form-success">{feedback}</p> : null}
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button className="primary-action" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Adding..." : "Add action"}
      </button>
    </form>
  );
}

function getActionTypeLabel(type: AdminModerationActionType): string {
  switch (type) {
    case "note":
      return "Note";
    case "review_started":
      return "Review started";
    case "dismissed":
      return "Dismissed";
    case "resolved":
      return "Resolved";
    case "action_taken":
      return "Action taken";
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
