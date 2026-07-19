"use client";

import { useState } from "react";

import { clearAuthToken } from "../../lib/auth-client";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { TextInput } from "../../components/ui";
import {
  confirmAccountDeletion,
  requestAccountDeletion
} from "./account-deletion-api";
import {
  ACCOUNT_DELETION_CONFIRMATION,
  getAccountDeletionErrorMessage,
  normalizeAccountDeletionCode,
  validateAccountDeletionConfirmation
} from "./account-deletion-model";

type AccountDeletionStep = "closed" | "request" | "confirm";

export function AccountDeletionPanel({
  apiBaseUrl,
  embedded = false
}: {
  apiBaseUrl: string;
  embedded?: boolean;
}) {
  const { isAuthenticated, isCheckingAuth } = useProtectedRoute({
    apiBaseUrl,
    redirectTo: "/"
  });
  const [step, setStep] = useState<AccountDeletionStep>("closed");
  const [currentPassword, setCurrentPassword] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"request" | "confirm" | null>(null);

  if (isCheckingAuth || !isAuthenticated) {
    return null;
  }

  function resetFlow() {
    if (pendingAction) {
      return;
    }

    setStep("closed");
    setCurrentPassword("");
    setChallengeId(null);
    setCode("");
    setConfirmation("");
    setErrorMessage(null);
  }

  async function handleRequestCode() {
    setPendingAction("request");
    setErrorMessage(null);

    try {
      const response = await requestAccountDeletion(apiBaseUrl, currentPassword);

      if (!response.ok) {
        setErrorMessage(
          getAccountDeletionErrorMessage(
            response.error.code,
            response.error.message
          )
        );
        return;
      }

      setChallengeId(response.data.challengeId);
      setCurrentPassword("");
      setStep("confirm");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleConfirmDeletion() {
    const validationError = validateAccountDeletionConfirmation({
      code,
      confirmation
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!challengeId) {
      setErrorMessage("Hesap silme güvenlik kodunu yeniden iste.");
      setStep("request");
      return;
    }

    setPendingAction("confirm");
    setErrorMessage(null);

    try {
      const response = await confirmAccountDeletion(apiBaseUrl, {
        challengeId,
        code,
        confirmation: ACCOUNT_DELETION_CONFIRMATION
      });

      if (!response.ok) {
        setErrorMessage(
          getAccountDeletionErrorMessage(
            response.error.code,
            response.error.message
          )
        );
        return;
      }

      clearAuthToken({ broadcast: true });
      window.location.replace("/?accountDeleted=1");
    } finally {
      setPendingAction(null);
    }
  }

  const isRequestStep = step === "request";
  const isConfirmStep = step === "confirm";

  return (
    <section
      aria-labelledby="account-deletion-title"
      className={embedded ? "w-full" : "mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6"}
    >
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">
          Tehlikeli alan
        </p>
        <h2
          className="mt-2 text-2xl font-black tracking-tight text-slate-950"
          id="account-deletion-title"
        >
          Hesabı kalıcı olarak sil
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
          Bu işlem geri alınamaz. Çocuk profilleri, favoriler, kayıtlı aramalar,
          bildirim tercihleri ve özel hesap verileri silinir. Pazaryeri
          bütünlüğü için tutulması gereken geçmiş kayıtlar “Silinmiş kullanıcı”
          olarak anonimleştirilir.
        </p>

        {step === "closed" ? (
          <button
            className="mt-5 rounded-full bg-red-700 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            onClick={() => {
              setStep("request");
              setErrorMessage(null);
            }}
            type="button"
          >
            Hesabımı sil
          </button>
        ) : null}

        {isRequestStep ? (
          <div className="mt-5 grid gap-4 rounded-2xl border border-red-200 bg-white p-5">
            <div>
              <h3 className="text-lg font-black text-slate-950">
                E-posta güvenlik kodu iste
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Şifreyle açılan hesaplarda mevcut şifreni gir. Yalnızca Google
                ile giriş yaptıysan alanı boş bırakabilirsin.
              </p>
            </div>

            <TextInput
              autoComplete="current-password"
              className="rounded-xl border-slate-300 bg-white font-normal text-slate-950"
              disabled={pendingAction !== null}
              label="Mevcut şifre"
              labelClassName="grid gap-2 text-sm font-bold text-slate-800"
              maxLength={128}
              placeholder="Google hesabında boş bırak"
              type="password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setErrorMessage(null);
              }}
            />

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-red-700 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                disabled={pendingAction !== null}
                onClick={() => void handleRequestCode()}
                type="button"
              >
                {pendingAction === "request" ? "Kod gönderiliyor..." : "Kodu gönder"}
              </button>
              <button
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 disabled:opacity-60"
                disabled={pendingAction !== null}
                onClick={resetFlow}
                type="button"
              >
                Vazgeç
              </button>
            </div>
          </div>
        ) : null}

        {isConfirmStep ? (
          <div className="mt-5 grid gap-4 rounded-2xl border border-red-200 bg-white p-5">
            <div>
              <h3 className="text-lg font-black text-slate-950">
                Silme işlemini son kez onayla
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                E-postana gelen 6 haneli kodu gir ve onay alanına tam olarak{" "}
                <strong>{ACCOUNT_DELETION_CONFIRMATION}</strong> yaz.
              </p>
            </div>

            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Güvenlik kodu
              <input
                autoComplete="one-time-code"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal tracking-[0.3em] text-slate-950"
                disabled={pendingAction !== null}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => {
                  setCode(normalizeAccountDeletionCode(event.target.value));
                  setErrorMessage(null);
                }}
                placeholder="000000"
                value={code}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Kalıcı silme onayı
              <input
                autoComplete="off"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-950"
                disabled={pendingAction !== null}
                maxLength={32}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setErrorMessage(null);
                }}
                placeholder={ACCOUNT_DELETION_CONFIRMATION}
                value={confirmation}
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-red-700 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                disabled={pendingAction !== null}
                onClick={() => void handleConfirmDeletion()}
                type="button"
              >
                {pendingAction === "confirm"
                  ? "Hesap siliniyor..."
                  : "Hesabı kalıcı olarak sil"}
              </button>
              <button
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 disabled:opacity-60"
                disabled={pendingAction !== null}
                onClick={resetFlow}
                type="button"
              >
                Vazgeç
              </button>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <p
            className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-800"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
