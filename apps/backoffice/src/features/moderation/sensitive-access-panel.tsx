"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { formatDateTimeTr } from "../../lib/presentation";

import {
  type AdminModerationCaseDetail,
  type AdminSensitiveAccessField,
  type RequestAdminSensitiveAccessResponse,
  requestAdminSensitiveAccess,
} from "./api";

type SensitiveAccessPanelProps = {
  moderationCase: AdminModerationCaseDetail;
};

const minimumReasonLength = 10;

const fieldOptions: Array<{
  field: AdminSensitiveAccessField;
  label: string;
  help: string;
}> = [
  {
    field: "reporter",
    label: "Şikâyetçi kimliği",
    help: "Vakada şikâyet varsa profil kimliği, görünen ad ve e-posta.",
  },
  {
    field: "message",
    label: "Ham ileti gövdesi",
    help: "Yalnız ileti hedefli moderasyon vakalarında döndürülür.",
  },
];

export function SensitiveAccessPanel({
  moderationCase,
}: SensitiveAccessPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedFields, setSelectedFields] = useState<AdminSensitiveAccessField[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sensitiveResult, setSensitiveResult] =
    useState<RequestAdminSensitiveAccessResponse | null>(null);

  const trimmedReason = reason.trim();
  const reasonIsValid = trimmedReason.length >= minimumReasonLength;
  const fieldsAreValid = selectedFields.length > 0;
  const canSubmit = reasonIsValid && fieldsAreValid && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSensitiveResult(null);

    if (!reasonIsValid) {
      setErrorMessage("En az 10 karakterlik bir erişim nedeni gir.");
      return;
    }

    if (!fieldsAreValid) {
      setErrorMessage("En az bir hassas alan seç.");
      return;
    }

    setIsSubmitting(true);

    const response = await requestAdminSensitiveAccess(moderationCase.id, {
      reason: trimmedReason,
      fields: selectedFields,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(
        getApiErrorMessage(response, "Hassas erişim isteği tamamlanamadı."),
      );
      return;
    }

    setSensitiveResult(response.data);
  }

  function toggleField(field: AdminSensitiveAccessField, checked: boolean) {
    setSensitiveResult(null);
    setSelectedFields((currentFields) => {
      if (checked) {
        return currentFields.includes(field)
          ? currentFields
          : [...currentFields, field];
      }

      return currentFields.filter((currentField) => currentField !== field);
    });
  }

  function clearSensitiveData() {
    setSensitiveResult(null);
    setErrorMessage(null);
  }

  return (
    <section className="form-card sensitive-access-card">
      <div>
        <p className="eyebrow">Hassas erişim</p>
        <h3>Hassas erişim</h3>
        <p>
          Ham hassas veri varsayılan olarak gizlidir. Yalnız moderasyon incelemesi
          için zorunlu olduğunda erişim iste. Neden ve istenen alanlar denetlenir.
        </p>
      </div>

      {!isExpanded ? (
        <button
          className="secondary-action"
          onClick={() => setIsExpanded(true)}
          type="button"
        >
          Hassas erişim iste
        </button>
      ) : (
        <form className="sensitive-access-form" onSubmit={handleSubmit}>
          <div className="state-panel warning">
            Bu işlem sunucu tarafı yetki kontrolünden sonra ham hassas veriyi açar.
            Kesinlikle gerekli olmadıkça bu veriyi notlara kopyalama.
          </div>

          <label className="form-field">
            <span>Erişim nedeni</span>
            <textarea
              onChange={(event) => {
                setSensitiveResult(null);
                setReason(event.target.value);
              }}
              placeholder="Bu moderasyon kararı için ham erişimin neden gerekli olduğunu açıkla."
              rows={4}
              value={reason}
            />
          </label>

          <fieldset className="checkbox-group">
            <legend>Hassas alanlar</legend>
            {fieldOptions.map((option) => (
              <label className="checkbox-option" key={option.field}>
                <input
                  checked={selectedFields.includes(option.field)}
                  onChange={(event) => toggleField(option.field, event.target.checked)}
                  type="checkbox"
                  value={option.field}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.help}</small>
                </span>
              </label>
            ))}
          </fieldset>

          {!reasonIsValid && reason.length > 0 ? (
            <p className="form-error" role="alert">
              En az 10 karakterlik bir erişim nedeni gir.
            </p>
          ) : null}

          {!fieldsAreValid && reasonIsValid ? (
            <p className="form-error" role="alert">
              En az bir hassas alan seç.
            </p>
          ) : null}

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="primary-action" disabled={!canSubmit} type="submit">
            {isSubmitting
              ? "İsteniyor…"
              : "Hassas erişim isteğini gönder"}
          </button>
        </form>
      )}

      {sensitiveResult ? (
        <SensitiveAccessResult
          onClear={clearSensitiveData}
          result={sensitiveResult}
        />
      ) : null}
    </section>
  );
}

function SensitiveAccessResult({
  onClear,
  result,
}: {
  onClear: () => void;
  result: RequestAdminSensitiveAccessResponse;
}) {
  return (
    <section className="sensitive-result" aria-label="Hassas erişim sonucu">
      <div className="page-toolbar">
        <div>
          <h3>Hassas erişim verildi</h3>
          <p>Denetim olayı: {result.auditEventId}</p>
        </div>
        <button className="secondary-action" onClick={onClear} type="button">
          Hassas veriyi temizle
        </button>
      </div>

      {result.sensitive.reporter ? (
        <dl className="details-grid sensitive-details">
          <div>
            <dt>Şikâyetçi profil kimliği</dt>
            <dd>{result.sensitive.reporter.profileId}</dd>
          </div>
          <div>
            <dt>Şikâyetçi görünen adı</dt>
            <dd>{result.sensitive.reporter.displayName ?? "Bulunmuyor"}</dd>
          </div>
          <div>
            <dt>Şikâyetçi e-postası</dt>
            <dd>{result.sensitive.reporter.email ?? "Bulunmuyor"}</dd>
          </div>
        </dl>
      ) : null}

      {result.sensitive.message ? (
        <dl className="details-grid sensitive-details">
          <div>
            <dt>İleti kimliği</dt>
            <dd>{result.sensitive.message.id}</dd>
          </div>
          <div>
            <dt>Gönderen profil kimliği</dt>
            <dd>{result.sensitive.message.senderProfileId}</dd>
          </div>
          <div>
            <dt>Oluşturulma</dt>
            <dd>{formatDateTimeTr(result.sensitive.message.createdAt)}</dd>
          </div>
          <div className="full-field">
            <dt>Ham ileti gövdesi</dt>
            <dd className="sensitive-text">{result.sensitive.message.body}</dd>
          </div>
        </dl>
      ) : null}

      {!result.sensitive.reporter && !result.sensitive.message ? (
        <div className="state-panel">
          Seçilen alanlar için hassas veri dönmedi.
        </div>
      ) : null}
    </section>
  );
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  if (response.error?.code === "FORBIDDEN") {
    return "Hassas erişim reddedildi. Bu istek denetlenebilir.";
  }

  if (response.error?.code === "INVALID_REQUEST") {
    return "Hassas erişim isteği geçersiz. Nedeni ve seçilen alanları kontrol et.";
  }

  if (response.error?.code === "NOT_FOUND") {
    return "Moderasyon vakası bulunamadı.";
  }

  return fallback;
}
