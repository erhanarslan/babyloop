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
      setErrorMessage("Yönetici notu zorunludur.");
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
      setErrorMessage(getApiErrorMessage(response, "İşlem eklenemedi."));
      return;
    }

    onCreated(response.data.case);
    setNote("");
    setActionType("note");
    setFeedback("İşlem eklendi.");
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div>
        <h3>Not veya işlem ekle</h3>
        <p>
          İç moderasyon notu veya iş akışı işlemi ekle. Denetlenen ilan ya da ileti
          durumu değişiklikleri için yaptırım panelini kullan.
        </p>
      </div>

      <label className="form-field">
        <span>İşlem türü</span>
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
        <span>Yönetici notu</span>
        <textarea
          onChange={(event) => setNote(event.target.value)}
          placeholder="Açık bir moderasyon notu yaz; gereksiz kişisel veri ekleme."
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
        {isSubmitting ? "Ekleniyor…" : "İşlem ekle"}
      </button>
    </form>
  );
}

function getActionTypeLabel(type: AdminModerationActionType): string {
  switch (type) {
    case "note":
      return "Not";
    case "review_started":
      return "İnceleme başlatıldı";
    case "dismissed":
      return "Kapatıldı";
    case "resolved":
      return "Çözüldü";
    case "action_taken":
      return "İşlem uygulandı";
  }
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.code === "FORBIDDEN"
    ? "Moderasyon işlemi ekleme yetkin yok."
    : fallback;
}
