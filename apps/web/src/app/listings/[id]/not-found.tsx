"use client";

import Link from "next/link";
import { PageContainer, PageHeading, SiteShell } from "../../../components/ui";
import { useI18n } from "../../../lib/i18n/i18n-provider";

export default function ListingNotFound() {
  const { dictionary } = useI18n();

  return (
    <SiteShell>
      <PageHeading
        eyebrow={dictionary.listings.detailEyebrow}
        title={dictionary.listings.detailNotFoundTitle}
        description={dictionary.listings.detailNotFoundDescription}
      />
      <PageContainer>
        <Link className="primary-link" href="/browse">
          {dictionary.common.backToBrowse}
        </Link>
      </PageContainer>
    </SiteShell>
  );
}
