import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";
import { AuditEventList } from "../../features/audit/audit-event-list";

export default function AuditPage() {
  return (
    <BackofficeAuthShell>
      <AuditEventList />
    </BackofficeAuthShell>
  );
}
