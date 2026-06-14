import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { redirect } from "next/navigation";

import { getBackofficeBaseUrl } from "../../lib/backoffice";

export const metadata: Metadata = buildNoIndexMetadata(
  "Admin redirect",
  "BabyLoop deprecated admin redirect pages are not indexed."
);

export default function DeprecatedAdminPage() {
  redirect(getBackofficeBaseUrl());
}
