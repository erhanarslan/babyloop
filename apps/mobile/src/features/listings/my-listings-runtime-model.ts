export const MOBILE_PENDING_PUBLICATION_POLL_DELAYS_MS = [7_000, 12_000, 20_000, 30_000] as const;

export function getMobilePendingPublicationPollDelay(attempt: number): number {
  const normalizedAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  const index = Math.min(normalizedAttempt, MOBILE_PENDING_PUBLICATION_POLL_DELAYS_MS.length - 1);
  return MOBILE_PENDING_PUBLICATION_POLL_DELAYS_MS[index];
}

export function shouldPollMobilePendingPublication(input: {
  appState: string;
  hasCurrentUser: boolean;
  hasPendingPublication: boolean;
  isFocused: boolean;
  status: string;
}): boolean {
  return input.appState === "active" &&
    input.hasCurrentUser &&
    input.hasPendingPublication &&
    input.isFocused &&
    input.status === "ready";
}
