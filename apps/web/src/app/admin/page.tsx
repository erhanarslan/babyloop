import { AdminAuth } from "../../features/admin/admin-auth";
import { AdminHome } from "../../features/admin/admin-home";
import { getApiBaseUrl } from "../../lib/api";

export default function AdminPage() {
  const apiBaseUrl = getApiBaseUrl();

  return (
    <AdminAuth apiBaseUrl={apiBaseUrl}>
      <main className="page-section">
        <AdminHome />
      </main>
    </AdminAuth>
  );
}