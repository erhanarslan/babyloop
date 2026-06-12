import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";
import { ListingAdminList } from "../../features/listings/listing-admin-list";

export default function BackofficeListingsPage() {
  return (
    <BackofficeAuthShell>
      <ListingAdminList />
    </BackofficeAuthShell>
  );
}
