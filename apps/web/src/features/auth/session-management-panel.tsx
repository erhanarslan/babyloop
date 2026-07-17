"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, LoadingBlock } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { clearAuthToken } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  fetchAuthSessions,
  revokeAllAuthSessionsRequest,
  revokeAuthSessionRequest,
  type AuthSessionPayload
} from "./api";

type SessionManagementPanelProps = {
  apiBaseUrl: string;
};

type PanelStatus = "loading" | "ready" | "error";

export function SessionManagementPanel({ apiBaseUrl }: SessionManagementPanelProps) {
  const { dictionary } = useI18n();
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [sessions, setSessions] = useState<AuthSessionPayload[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const clearProtectedState = useCallback(() => {
    setStatus("ready");
    setSessions([]);
    setCurrentSessionId(null);
    setPendingSessionId(null);
    setIsRevokingAll(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => Number(b.current) - Number(a.current));
  }, [sessions]);

  const loadSessions = useCallback(async () => {
    if (!(await requireAuth())) {
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const body = await fetchAuthSessions(apiBaseUrl);

      if (!body.ok) {
        setStatus("error");
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setSessions(body.data.sessions);
      setCurrentSessionId(body.data.currentSessionId);
      setStatus("ready");
    } catch {
      setStatus("error");
      setErrorMessage(dictionary.common.apiUnavailable);
    }
  }, [apiBaseUrl, dictionary, requireAuth]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function handleRevokeSession(sessionId: string) {
    if (pendingSessionId || isRevokingAll) {
      return;
    }

    if (!(await requireAuth())) {
      return;
    }

    setPendingSessionId(sessionId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const body = await revokeAuthSessionRequest(apiBaseUrl, sessionId);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      if (body.data.currentSessionRevoked) {
        clearAuthToken({ broadcast: true });
        setSessions([]);
        setCurrentSessionId(null);
        setSuccessMessage("Bu oturum kapatıldı. Tekrar giriş yapman gerekiyor.");
        window.location.replace("/login");
        return;
      }

      setSessions((current) => current.filter((session) => session.id !== body.data.sessionId));
      setSuccessMessage("Seçili oturum kapatıldı.");
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setPendingSessionId(null);
    }
  }

  async function handleRevokeAllSessions() {
    if (isRevokingAll || pendingSessionId) {
      return;
    }

    if (!(await requireAuth())) {
      return;
    }

    setIsRevokingAll(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const body = await revokeAllAuthSessionsRequest(apiBaseUrl);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      clearAuthToken({ broadcast: true });
      setSessions([]);
      setCurrentSessionId(null);
      setSuccessMessage(`${body.data.revokedCount} oturum kapatıldı. Tüm cihazlardan çıkış yapıldı.`);
      window.location.replace("/login");
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsRevokingAll(false);
    }
  }

  if (isCheckingAuth || status === "loading") {
    return <LoadingBlock title="Oturumlar yükleniyor" message="Aktif cihazların hazırlanıyor." />;
  }

  return (
    <section className="listing-form auth-recovery-form" aria-label="Aktif oturumlar">
      <div className="auth-form-intro">
        <p className="eyebrow">Oturumlar</p>
        <h2>Aktif cihazlar</h2>
        <p>
          Hesabına açık olan web ve mobil oturumları buradan takip edebilir, kaybolan cihazdaki oturumu
          kapatabilir veya tüm cihazlardan çıkış yapabilirsin.
        </p>
      </div>

      <div className="auth-security-summary" aria-label="Oturum özeti">
        <div>
          <strong>{sessions.length}</strong>
          <span>Aktif oturum</span>
        </div>
        <div>
          <strong>{currentSessionId ? "Bu cihaz bulundu" : "Bu cihaz eşleşmedi"}</strong>
          <span>Mevcut oturum refresh cookie ile eşleştirilir; token/hash kullanıcıya gösterilmez.</span>
        </div>
      </div>

      {errorMessage ? <Alert title="Oturumlar güncellenemedi" message={errorMessage} /> : null}

      {successMessage ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm font-bold text-primary" role="status">
          {successMessage}
        </div>
      ) : null}

      {status === "error" ? (
        <Button type="button" variant="secondary" onClick={() => void loadSessions()}>
          Tekrar dene
        </Button>
      ) : null}

      {status === "ready" && sortedSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/80 p-4">
          <h3 className="text-base font-black text-foreground">Aktif oturum görünmüyor</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Tüm cihazlardan çıkış yaptıysan tekrar giriş yaptığında yeni oturum burada görünür.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3">
        {sortedSessions.map((session) => (
          <article
            className="rounded-2xl border border-border bg-card/80 p-4"
            key={session.id}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black text-foreground">{session.deviceLabel}</h3>
                  {session.current ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
                      Bu cihaz
                    </span>
                  ) : null}
                </div>

                <p className="text-sm leading-6 text-muted-foreground">
                  {session.userAgent ?? "Cihaz bilgisi yok"}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  IP: {session.ipAddress ?? "Bilinmiyor"} · Son güncelleme: {formatSessionDate(session.updatedAt)}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  Bitiş: {formatSessionDate(session.expiresAt)}
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                disabled={pendingSessionId === session.id || isRevokingAll}
                onClick={() => void handleRevokeSession(session.id)}
              >
                {pendingSessionId === session.id
                  ? "Kapatılıyor..."
                  : session.current
                    ? "Bu oturumu kapat"
                    : "Oturumu kapat"}
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="form-actions auth-form-actions">
        <p className="form-note">
          Tüm cihazlardan çıkış yaptığında mevcut cihaz dahil açık refresh oturumları iptal edilir.
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={isRevokingAll || sessions.length === 0}
          onClick={() => void handleRevokeAllSessions()}
        >
          {isRevokingAll ? "Tüm oturumlar kapatılıyor..." : "Tüm cihazlardan çıkış yap"}
        </Button>
      </div>
    </section>
  );
}

function formatSessionDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Bilinmiyor";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}
