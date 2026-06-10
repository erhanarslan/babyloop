import { AdminAuth } from "../../../../features/admin/admin-auth";
import { ModerationCaseDetail } from "../../../../features/admin/moderation-case-detail";
import { getApiBaseUrl } from "../../../../lib/api";

type AdminModerationCasePageProps = {
  params: {
    caseId: string;
  };
};

export default function AdminModerationCasePage({
  params,
}: AdminModerationCasePageProps) {
  const apiBaseUrl = getApiBaseUrl();

  return (
    <AdminAuth apiBaseUrl={apiBaseUrl}>
      <main className="page-section">
        <ModerationCaseDetail caseId={params.caseId} />
      </main>
    </AdminAuth>
  );
}