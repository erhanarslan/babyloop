"use client";

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";
import { useI18n } from "../../../lib/i18n/i18n-provider";

export default function ListingDetailLoading() {
  const { dictionary } = useI18n();

  return (
    <SiteShell>
      <PageHeading
        eyebrow={dictionary.listings.detailEyebrow}
        title={dictionary.listings.loadingDetailTitle}
      />
      <PageContainer>
        <LoadingBlock
          title={dictionary.listings.fetchingDetailTitle}
          message={dictionary.listings.fetchingDetailMessage}
        />
      </PageContainer>
    </SiteShell>
  );
}
