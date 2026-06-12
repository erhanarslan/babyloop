import { BackofficeAuthShell } from "../../../features/auth/backoffice-auth-shell";
import { ListingAdminDetail } from "../../../features/listings/listing-admin-detail";

type BackofficeListingDetailPageProps = {
  params: Promise<{
    listingId: string;
  }>;
};

export default async function BackofficeListingDetailPage({
  params,
}: BackofficeListingDetailPageProps) {
  const { listingId } = await params;

  return (
    <BackofficeAuthShell>
      <ListingAdminDetail listingId={listingId} />
    </BackofficeAuthShell>
  );
}
