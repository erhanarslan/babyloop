import { BackofficeAuthShell } from "../features/auth/backoffice-auth-shell";
import { DashboardHome } from "../features/dashboard/dashboard-home";

export default function BackofficeHomePage() {
  return (
    <BackofficeAuthShell>
      <DashboardHome />
    </BackofficeAuthShell>
  );
}
