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
      setErrorMessage(getApiErrorMessage(response, "Durum güncellenemedi."));
      return;
    }

    onUpdated(response.data.case);
    setNote("");
    setFeedback("Durum güncellendi.");
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div>
        <h3>Durumu güncelle</h3>
        <p>Bu vakanın moderasyon iş akışı durumunu değiştir.</p>
      </div>

      <label className="form-field">
        <span>Durum</span>
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
        <span>Durum notu</span>
        <textarea
          maxLength={1000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="İsteğe bağlı iş akışı notu; gereksiz kişisel veri ekleme."
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
        {isSubmitting ? "Güncelleniyor…" : "Durumu güncelle"}
      </button>
    </form>
  );
}

function getStatusLabel(status: AdminModerationCaseStatus): string {
  switch (status) {
    case "pending":
      return "Bekliyor";
    case "in_review":
      return "İncelemede";
    case "resolved":
      return "Çözüldü";
    case "dismissed":
      return "Kapatıldı";
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
    ? "Vaka durumunu değiştirme yetkin yok."
    : fallback;
}
