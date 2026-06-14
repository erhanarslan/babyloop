import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../../lib/seo";
import { redirect } from "next/navigation";

import { getBackofficeBaseUrl } from "../../../../lib/backoffice";

type DeprecatedAdminModerationCasePageProps = {
  params: {
    caseId: string;
  };
};

export const metadata: Metadata = buildNoIndexMetadata(
  "Admin moderation case redirect",
  "BabyLoop deprecated admin moderation case redirect pages are not indexed."
);

export default function DeprecatedAdminModerationCasePage({
  params,
}: DeprecatedAdminModerationCasePageProps) {
  redirect(`${getBackofficeBaseUrl()}/moderation/${params.caseId}`);
}
