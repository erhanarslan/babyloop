import type { BackofficeAnalyticsOverview } from "./analytics-api";

export type AnalyticsKpiCard = {
  label: string;
  value: string;
};

export function buildAnalyticsOverviewKpis(
  overview: BackofficeAnalyticsOverview
): AnalyticsKpiCard[] {
  return [
    { label: "Registered users", value: String(overview.totalRegisteredUsers) },
    { label: "Verified users", value: `${overview.verifiedUsers} (${overview.verifiedRate}%)` },
    { label: "Google linked", value: `${overview.googleLinkedUsers} (${overview.googleLinkedRate}%)` },
    { label: "Active users", value: String(overview.activeUsers) },
    { label: "Sessions", value: String(overview.sessions) },
    { label: "Avg engagement", value: formatDuration(overview.averageSessionEngagementMs) },
    { label: "Listing views", value: String(overview.listingViews) },
    { label: "Message senders", value: String(overview.messageSenders) },
    { label: "Assistant users", value: String(overview.assistantUsers) },
    { label: "Checkout users", value: String(overview.checkoutUsers) }
  ];
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }

  const seconds = Math.round(ms / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}
