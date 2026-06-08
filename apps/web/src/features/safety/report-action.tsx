"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, Select, Textarea } from "../../components/ui";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import type { ReportReason } from "./api";

type ReportActionProps = {
  actionLabel: string;
  onSubmitReport: (payload: { reason: ReportReason; details?: string }) => Promise<{
    ok: true;
  } | {
    ok: false;
    error: ApiError;
  }>;
};

const REPORT_REASONS: ReportReason[] = [
  "safety",
  "scam",
  "inappropriate",
  "prohibited_item",
  "harassment",
  "other"
];

export function ReportAction({ actionLabel, onSubmitReport }: ReportActionProps) {
  const { dictionary } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("safety");
  const [details, setDetails] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{ tone: "info" | "error"; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setResult(null);

    try {
      const response = await onSubmitReport({
        reason,
        ...(details.trim() ? { details: details.trim() } : {})
      });

      if (!response.ok) {
        setResult({
          tone: "error",
          message: getApiErrorMessage(response.error, dictionary)
        });
        return;
      }

      setDetails("");
      setIsOpen(false);
      setResult({
        tone: "info",
        message: dictionary.safety.reportSubmitted
      });
    } catch {
      setResult({
        tone: "error",
        message: dictionary.common.apiUnavailable
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="safety-action">
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setIsOpen((current) => !current);
          setResult(null);
        }}
      >
        {actionLabel}
      </Button>

      {isOpen ? (
        <form className="safety-form" onSubmit={handleSubmit}>
          <Select
            label={dictionary.safety.reason}
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportReason)}
          >
            {REPORT_REASONS.map((item) => (
              <option key={item} value={item}>
                {dictionary.safety.reasons[item]}
              </option>
            ))}
          </Select>
          <Textarea
            label={dictionary.safety.details}
            maxLength={1000}
            rows={3}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={dictionary.safety.detailsPlaceholder}
          />
          <div className="form-actions">
            <Button disabled={isPending} type="submit">
              {isPending ? dictionary.safety.submitting : dictionary.safety.submitReport}
            </Button>
            <Button
              disabled={isPending}
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
            >
              {dictionary.safety.cancel}
            </Button>
          </div>
        </form>
      ) : null}

      {result ? (
        <Alert
          tone={result.tone}
          title={result.tone === "info" ? dictionary.safety.reportSubmittedTitle : dictionary.safety.actionFailed}
          message={result.message}
        />
      ) : null}
    </div>
  );
}
