"use client";

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";

export default function SellLoading() {
  const { dictionary } = useI18n();

  return (
    <SiteShell>
      <PageHeading
        eyebrow={dictionary.listings.sellEyebrow}
        title={dictionary.common.loading}
      />
      <PageContainer>
        <LoadingBlock
          title={dictionary.common.loading}
          message={dictionary.listings.fetchingMarketplaceMessage}
        />
      </PageContainer>
    </SiteShell>
  );
}
