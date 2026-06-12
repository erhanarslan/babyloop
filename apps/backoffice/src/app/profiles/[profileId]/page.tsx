import { BackofficeAuthShell } from "../../../features/auth/backoffice-auth-shell";
import { ProfileAdminDetail } from "../../../features/profiles/profile-admin-detail";

export default function BackofficeProfileDetailPage({
  params,
}: {
  params: { profileId: string };
}) {
  return (
    <BackofficeAuthShell>
      <ProfileAdminDetail profileId={params.profileId} />
    </BackofficeAuthShell>
  );
}
