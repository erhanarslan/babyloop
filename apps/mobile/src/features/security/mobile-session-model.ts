import type { MobileAuthSession } from "../auth/auth-api";

export type MobileSessionCard = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  isCurrent: boolean;
  actionLabel: string;
};

export function buildMobileSessionCards(
  sessions: MobileAuthSession[],
  currentSessionId: string | null
): MobileSessionCard[] {
  return [...sessions]
    .sort((a, b) => Number(isCurrentSession(b, currentSessionId)) - Number(isCurrentSession(a, currentSessionId)))
    .map((session) => {
      const isCurrent = isCurrentSession(session, currentSessionId);

      return {
        id: session.id,
        title: safeSessionText(session.deviceLabel, "Bilinmeyen cihaz"),
        subtitle: safeSessionText(session.userAgent, "Cihaz bilgisi yok"),
        meta: buildSessionMeta(session),
        isCurrent,
        actionLabel: isCurrent ? "Bu oturumu kapat" : "Oturumu kapat"
      };
    });
}

export function getMobileSessionSummary(
  sessions: MobileAuthSession[],
  currentSessionId: string | null
): {
  activeCountLabel: string;
  currentDeviceLabel: string;
} {
  return {
    activeCountLabel: `${sessions.length} aktif oturum`,
    currentDeviceLabel: currentSessionId ? "Bu cihaz eşleşti" : "Bu cihaz eşleşmedi"
  };
}

export function formatMobileSessionDate(value: string): string {
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

function isCurrentSession(session: MobileAuthSession, currentSessionId: string | null): boolean {
  return session.current || (Boolean(currentSessionId) && session.id === currentSessionId);
}

function buildSessionMeta(session: MobileAuthSession): string {
  const ipAddress = safeSessionText(session.ipAddress, "IP bilinmiyor");
  const updatedAt = formatMobileSessionDate(session.updatedAt);
  const expiresAt = formatMobileSessionDate(session.expiresAt);

  return `${ipAddress} · Son güncelleme ${updatedAt} · Bitiş ${expiresAt}`;
}

function safeSessionText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed
    .replace(/accessToken["':=\s]+[A-Za-z0-9._-]+/giu, "accessToken=[redacted]")
    .replace(/refreshToken["':=\s]+[A-Za-z0-9._-]+/giu, "refreshToken=[redacted]")
    .replace(/passwordHash["':=\s]+[A-Za-z0-9._-]+/giu, "passwordHash=[redacted]")
    .slice(0, 180);
}
