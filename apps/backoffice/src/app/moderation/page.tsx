import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";
import { ModerationCaseList } from "../../features/moderation/moderation-case-list";

export default function BackofficeModerationPage() {
  return (
    <BackofficeAuthShell>
      <ModerationCaseList />
    </BackofficeAuthShell>
  );
}
