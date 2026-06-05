"use client";

import { PageContainer, PageHeading } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { MyListingsList } from "./my-listings-list";

type MyListingsPageContentProps = {
  apiBaseUrl: string;
};

export function MyListingsPageContent({ apiBaseUrl }: MyListingsPageContentProps) {
  const { dictionary } = useI18n();

  return (
    <>
      <PageHeading
        eyebrow={dictionary.listings.myListingsEyebrow}
        title={dictionary.listings.myListingsTitle}
        description={dictionary.listings.myListingsDescription}
      />

      <PageContainer className="listing-column" ariaLabel={dictionary.listings.myListingsAriaLabel}>
        <MyListingsList apiBaseUrl={apiBaseUrl} />
      </PageContainer>
    </>
  );
}
