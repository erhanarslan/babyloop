import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";
import { ProfileAdminList } from "../../features/profiles/profile-admin-list";

export default function BackofficeProfilesPage() {
  return (
    <BackofficeAuthShell>
      <ProfileAdminList />
    </BackofficeAuthShell>
  );
}
