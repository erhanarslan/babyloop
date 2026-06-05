"use client";

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";

export default function BrowseLoading() {
  const { dictionary } = useI18n();

  return (
    <SiteShell>
      <PageHeading
        eyebrow={dictionary.listings.browseEyebrow}
        title={dictionary.listings.loadingListingsTitle}
      />
      <PageContainer>
        <LoadingBlock
          title={dictionary.listings.fetchingMarketplaceTitle}
          message={dictionary.listings.fetchingMarketplaceMessage}
        />
      </PageContainer>
    </SiteShell>
  );
}
