import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";
import { NotificationOpsPage } from "../../features/notifications/notification-ops-page";

export const metadata = {
  title: "Notification Ops | BabyLoop Backoffice"
};

export default function NotificationsPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  return (
    <BackofficeAuthShell>
      <NotificationOpsPage apiBaseUrl={apiBaseUrl} />
    </BackofficeAuthShell>
  );
}
