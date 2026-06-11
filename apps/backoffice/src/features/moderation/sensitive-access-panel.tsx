"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useState } from "react";

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
    label: "Reporter identity",
    help: "Profile id, display name, and email when the case has a report.",
  },
  {
    field: "message",
    label: "Raw message body",
    help: "Only returned for message-target moderation cases.",
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
      setErrorMessage("Enter a reason with at least 10 characters.");
      return;
    }

    if (!fieldsAreValid) {
      setErrorMessage("Select at least one sensitive field.");
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
        getApiErrorMessage(response, "Sensitive access request failed."),
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
        <p className="eyebrow">Sensitive access</p>
        <h3>Sensitive access</h3>
        <p>
          Raw sensitive data is hidden by default. Request access only when it
          is necessary for moderation review. Your reason and requested fields
          will be audited.
        </p>
      </div>

      {!isExpanded ? (
        <button
          className="secondary-action"
          onClick={() => setIsExpanded(true)}
          type="button"
        >
          Request sensitive access
        </button>
      ) : (
        <form className="sensitive-access-form" onSubmit={handleSubmit}>
          <div className="state-panel warning">
            This reveals raw sensitive data after a server-side permission check.
            Do not copy it into notes unless strictly required.
          </div>

          <label className="form-field">
            <span>Access reason</span>
            <textarea
              onChange={(event) => {
                setSensitiveResult(null);
                setReason(event.target.value);
              }}
              placeholder="Explain why raw access is needed for this moderation decision."
              rows={4}
              value={reason}
            />
          </label>

          <fieldset className="checkbox-group">
            <legend>Sensitive fields</legend>
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
              Enter a reason with at least 10 characters.
            </p>
          ) : null}

          {!fieldsAreValid && reasonIsValid ? (
            <p className="form-error" role="alert">
              Select at least one sensitive field.
            </p>
          ) : null}

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="primary-action" disabled={!canSubmit} type="submit">
            {isSubmitting
              ? "Requesting..."
              : "Submit sensitive access request"}
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
    <section className="sensitive-result" aria-label="Sensitive access result">
      <div className="page-toolbar">
        <div>
          <h3>Sensitive data granted</h3>
          <p>Audit event id: {result.auditEventId}</p>
        </div>
        <button className="secondary-action" onClick={onClear} type="button">
          Clear sensitive data
        </button>
      </div>

      {result.sensitive.reporter ? (
        <dl className="details-grid sensitive-details">
          <div>
            <dt>Reporter profile ID</dt>
            <dd>{result.sensitive.reporter.profileId}</dd>
          </div>
          <div>
            <dt>Reporter display name</dt>
            <dd>{result.sensitive.reporter.displayName ?? "Not available"}</dd>
          </div>
          <div>
            <dt>Reporter email</dt>
            <dd>{result.sensitive.reporter.email ?? "Not available"}</dd>
          </div>
        </dl>
      ) : null}

      {result.sensitive.message ? (
        <dl className="details-grid sensitive-details">
          <div>
            <dt>Message ID</dt>
            <dd>{result.sensitive.message.id}</dd>
          </div>
          <div>
            <dt>Sender profile ID</dt>
            <dd>{result.sensitive.message.senderProfileId}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDateTime(result.sensitive.message.createdAt)}</dd>
          </div>
          <div className="full-field">
            <dt>Raw message body</dt>
            <dd className="sensitive-text">{result.sensitive.message.body}</dd>
          </div>
        </dl>
      ) : null}

      {!result.sensitive.reporter && !result.sensitive.message ? (
        <div className="state-panel">
          No sensitive data was returned for the selected fields.
        </div>
      ) : null}
    </section>
  );
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

  if (response.error?.code === "FORBIDDEN") {
    return "Sensitive access denied. This request may be audited.";
  }

  if (response.error?.code === "INVALID_REQUEST") {
    return "Sensitive access request is invalid. Check the reason and selected fields.";
  }

  if (response.error?.code === "NOT_FOUND") {
    return "Moderation case was not found.";
  }

  return response.error?.message ?? fallback;
}
