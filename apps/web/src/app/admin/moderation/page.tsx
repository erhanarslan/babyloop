import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { redirect } from "next/navigation";

import { getBackofficeBaseUrl } from "../../../lib/backoffice";

export const metadata: Metadata = buildNoIndexMetadata(
  "Admin moderation redirect",
  "BabyLoop deprecated admin moderation redirect pages are not indexed."
);

export default function DeprecatedAdminModerationPage() {
  redirect(`${getBackofficeBaseUrl()}/moderation`);
}
