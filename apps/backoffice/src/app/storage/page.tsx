import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";
import { StorageOpsPage } from "../../features/storage/storage-ops-page";

export const metadata = {
  title: "Depolama Operasyonları | BabyLoop Backoffice"
};

export default function StoragePage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  return (
    <BackofficeAuthShell>
      <StorageOpsPage apiBaseUrl={apiBaseUrl} />
    </BackofficeAuthShell>
  );
}
