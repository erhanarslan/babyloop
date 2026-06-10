import { AdminAuth } from "../../../features/admin/admin-auth";
import { AdminModerationPageContent } from "../../../features/admin/admin-moderation-page-content";
import { getApiBaseUrl } from "../../../lib/api";

export default function AdminModerationPage() {
  const apiBaseUrl = getApiBaseUrl();

  return (
    <AdminAuth apiBaseUrl={apiBaseUrl}>
      <main className="page-section">
        <AdminModerationPageContent />
      </main>
    </AdminAuth>
  );
}