"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui";
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
import { CurrentPasswordConfirmationModal } from "./current-password-confirmation-modal";

type SessionManagementPanelProps = {
  apiBaseUrl: string;
};

export function SessionManagementPanel({ apiBaseUrl }: SessionManagementPanelProps) {
  const { dictionary } = useI18n();
  const [sessions, setSessions] = useState<AuthSessionPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRevokeAllModalOpen, setIsRevokeAllModalOpen] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({ apiBaseUrl });
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(b.current) - Number(a.current)),
    [sessions]
  );

  const loadSessions = useCallback(async () => {
    if (!(await requireAuth())) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetchAuthSessions(apiBaseUrl);

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error, dictionary));
        return;
      }

      setSessions(response.data.sessions);
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, dictionary, requireAuth]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function handleRevokeSession(sessionId: string) {
    if (pendingSessionId || isRevokingAll || !(await requireAuth())) {
      return;
    }

    setPendingSessionId(sessionId);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await revokeAuthSessionRequest(apiBaseUrl, sessionId);

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error, dictionary));
        return;
      }

      if (response.data.currentSessionRevoked) {
        clearAuthToken({ broadcast: true });
        window.location.replace("/?auth=login");
        return;
      }

      setSessions((current) => current.filter((session) => session.id !== response.data.sessionId));
      setStatusMessage("Oturum kapatıldı.");
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setPendingSessionId(null);
    }
  }

  async function handleRevokeAllSessions(currentPassword: string) {
    if (isRevokingAll || !(await requireAuth())) {
      return;
    }

    setIsRevokingAll(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await revokeAllAuthSessionsRequest(apiBaseUrl, currentPassword);

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error, dictionary));
        return;
      }

      clearAuthToken({ broadcast: true });
      setSessions([]);
      window.location.replace("/?auth=login");
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsRevokingAll(false);
    }
  }

  return (
    <section className="grid gap-3" aria-label="Oturum güvenliği">
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-5">
          <div>
            <h3 className="text-base font-black text-foreground">Aktif oturumlar</h3>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {isLoading || isCheckingAuth ? "Yükleniyor…" : `${sessions.length} açık oturum`}
            </p>
          </div>
          <Button
            aria-expanded={isExpanded}
            disabled={isLoading || isCheckingAuth}
            type="button"
            variant="secondary"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? "Gizle" : "Görüntüle"}
          </Button>
        </div>

        {isExpanded ? (
          <div className="mt-4 grid gap-2 border-t border-border/70 pt-4">
            {sortedSessions.length === 0 ? (
              <p className="text-sm font-semibold text-muted-foreground">Açık oturum bulunamadı.</p>
            ) : sortedSessions.map((session) => (
              <article className="flex items-center justify-between gap-4 rounded-xl bg-background p-3" key={session.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-foreground">{session.deviceLabel}</strong>
                    {session.current ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">Bu cihaz</span>
                    ) : null}
                  </div>
                  <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                    Son kullanım: {formatSessionDate(session.updatedAt)}
                  </span>
                </div>
                <Button
                  disabled={pendingSessionId !== null || isRevokingAll}
                  type="button"
                  variant="secondary"
                  onClick={() => void handleRevokeSession(session.id)}
                >
                  {pendingSessionId === session.id ? "Kapatılıyor…" : "Kapat"}
                </Button>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-5 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
        <div>
          <h3 className="text-base font-black text-foreground">Tüm oturumları kapat</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
            Bu cihaz dahil her yerdeki oturumunu sonlandır.
          </p>
        </div>
        <Button
          disabled={isLoading || sessions.length === 0}
          type="button"
          variant="secondary"
          onClick={() => {
            setErrorMessage(null);
            setIsRevokeAllModalOpen(true);
          }}
        >
          Tümünü kapat
        </Button>
      </div>

      {statusMessage ? <p className="text-sm font-bold text-primary" role="status">{statusMessage}</p> : null}
      {!isRevokeAllModalOpen && errorMessage ? (
        <p className="text-sm font-bold text-destructive" role="alert">{errorMessage}</p>
      ) : null}

      <CurrentPasswordConfirmationModal
        description="Tüm cihazlardaki oturumlarını kapatmak için mevcut şifreni doğrula."
        errorMessage={errorMessage}
        isOpen={isRevokeAllModalOpen}
        isSubmitting={isRevokingAll}
        submitLabel="Tümünü kapat"
        title="Tüm oturumları kapat"
        onClose={() => {
          if (!isRevokingAll) {
            setIsRevokeAllModalOpen(false);
            setErrorMessage(null);
          }
        }}
        onConfirm={(password) => void handleRevokeAllSessions(password)}
      />
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
    month: "short"
  }).format(date);
}
