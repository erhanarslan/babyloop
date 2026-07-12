import type { MobileAuthSession } from "../auth/auth-api";

export type MobileSessionCard = {
  id: string;
  title: string;
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
        meta: `Son etkinlik: ${formatMobileSessionDate(session.updatedAt)}`,
        isCurrent,
        actionLabel: isCurrent ? "" : "Kapat"
      };
    });
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

function safeSessionText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed
    .replace(/accessToken["':=\s]+[A-Za-z0-9._-]+/giu, "accessToken=[redacted]")
    .replace(/refreshToken["':=\s]+[A-Za-z0-9._-]+/giu, "refreshToken=[redacted]")
    .replace(/passwordHash["':=\s]+[A-Za-z0-9._-]+/giu, "passwordHash=[redacted]")
    .slice(0, 80);
}
