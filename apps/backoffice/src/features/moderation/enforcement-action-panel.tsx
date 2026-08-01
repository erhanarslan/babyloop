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
    label: "İlanı gizle",
    description: "İlanı arşivleyerek herkese açık görünümden kaldır.",
  },
  {
    action: "listing_restore",
    label: "İlanı geri yükle",
    description: "Yaptırım geri alındığında ilanı aktif duruma döndür.",
  },
];

const messageOptions: EnforcementOption[] = [
  {
    action: "message_hide",
    label: "Mesajı gizle",
    description: "Mevcut silinme zamanını kullanarak iletiyi gizli olarak işaretle.",
  },
  {
    action: "message_mark_reviewed",
    label: "Mesajı incelendi olarak işaretle",
    description: "Mesaj metnini değiştirmeden moderasyon incelemesini kaydet.",
  },
];

const profileOptions: EnforcementOption[] = [
  {
    action: "profile_warn",
    label: "Profili uyar",
    description: "Profil güvenlik durumunu değiştirmeden uyarı kaydet.",
  },
  {
    action: "profile_restrict",
    label: "Profili kısıtla",
    description: "Profilin ilan oluşturmasını veya mesaj göndermesini engelle.",
  },
  {
    action: "profile_suspend",
    label: "Profili askıya al",
    description: "Pazar yeri hareketlerini engelle ve satıcının herkese açık ilanlarını gizle.",
  },
  {
    action: "profile_restore",
    label: "Profili geri yükle",
    description: "Profili aktif pazaryeri durumuna döndür.",
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
      setErrorMessage("Bu vaka için uygulanabilir yaptırım yok.");
      return;
    }

    if (trimmedReason.length < 10) {
      setErrorMessage("En az 10 karakterlik bir yaptırım nedeni gir.");
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
      setErrorMessage(getApiErrorMessage(response, "Yaptırım uygulanamadı."));
      return;
    }

    onApplied(response.data.case);
    setReason("");
    setFeedback(
      `Yaptırım uygulandı. Denetim olayı: ${response.data.enforcement.auditEventId}`,
    );
  }

  return (
    <form className="form-card enforcement-card" onSubmit={handleSubmit}>
      <div>
        <h3>Yaptırım işlemleri</h3>
        <p>
          Yaptırımı yalnız vaka hedefinin moderasyon durumunu değiştirmek gerektiğinde
          kullan. Neden zorunludur ve işlem denetlenir.
        </p>
      </div>

      {options.length === 0 ? (
        <div className="state-panel">
          Bu hedef türü için henüz otomatik yaptırım işlemi yok.
        </div>
      ) : (
        <>
          <fieldset className="checkbox-group">
            <legend>İşlem</legend>
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
            <span>Yaptırım nedeni</span>
            <textarea
              onChange={(event) => setReason(event.target.value)}
              placeholder="Bu yaptırımın neden gerekli olduğunu açıkla; gereksiz kişisel veri ekleme."
              rows={4}
              value={reason}
            />
          </label>

          <div className="state-panel warning">
            Bu işlem moderasyon durumunu değiştirir ve denetim zaman çizelgesine
            kaydedilir. Hassas ham veri istemez veya göstermez.
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
        {isSubmitting ? "Uygulanıyor…" : "Yaptırım işlemini uygula"}
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

  if (targetType === "profile") {
    return profileOptions;
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

  return response.error?.code === "FORBIDDEN"
    ? "Bu yaptırımı uygulama yetkin yok."
    : fallback;
}
