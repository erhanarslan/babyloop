import { BackofficeAuthShell } from "../../../features/auth/backoffice-auth-shell";
import { ModerationCaseDetail } from "../../../features/moderation/moderation-case-detail";

type BackofficeModerationCasePageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

export default async function BackofficeModerationCasePage({
  params,
}: BackofficeModerationCasePageProps) {
  const { caseId } = await params;

  return (
    <BackofficeAuthShell>
      <ModerationCaseDetail caseId={caseId} />
    </BackofficeAuthShell>
  );
}