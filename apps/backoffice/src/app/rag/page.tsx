import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";
import { RagManagementPage } from "../../features/rag/rag-management-page";

export default function BackofficeRagPage() {
  return (
    <BackofficeAuthShell>
      <RagManagementPage />
    </BackofficeAuthShell>
  );
}
