import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";
import { AiOpsDashboard } from "../../features/ai-ops/ai-ops-dashboard";

export default function BackofficeAiOpsPage() {
  return (
    <BackofficeAuthShell>
      <AiOpsDashboard />
    </BackofficeAuthShell>
  );
}
