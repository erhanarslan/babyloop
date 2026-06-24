import { StorageOpsPage } from "../../features/storage/storage-ops-page";

export const metadata = {
  title: "Storage Ops | BabyLoop Backoffice"
};

export default function StoragePage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  return <StorageOpsPage apiBaseUrl={apiBaseUrl} />;
}
