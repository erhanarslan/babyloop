import { redirect } from "next/navigation";

import { getBackofficeBaseUrl } from "../../lib/backoffice";

export default function DeprecatedAdminPage() {
  redirect(getBackofficeBaseUrl());
}
