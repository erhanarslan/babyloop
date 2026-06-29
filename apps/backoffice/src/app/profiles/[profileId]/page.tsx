import { BackofficeAuthShell } from "../../../features/auth/backoffice-auth-shell";
import { ProfileAdminDetail } from "../../../features/profiles/profile-admin-detail";

type BackofficeProfileDetailPageProps = {
  params: Promise<{
    profileId: string;
  }>;
};

export default async function BackofficeProfileDetailPage({
  params,
}: BackofficeProfileDetailPageProps) {
  const { profileId } = await params;

  return (
    <BackofficeAuthShell>
      <ProfileAdminDetail profileId={profileId} />
    </BackofficeAuthShell>
  );
}
