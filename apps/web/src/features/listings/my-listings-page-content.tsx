"use client";

import { PageContainer } from "../../components/ui";
import { MyListingsList } from "./my-listings-list";

type MyListingsPageContentProps = {
  apiBaseUrl: string;
};

export function MyListingsPageContent({ apiBaseUrl }: MyListingsPageContentProps) {
  return (
    <PageContainer className="pb-12 pt-5" ariaLabel="İlanlarım">
      <MyListingsList apiBaseUrl={apiBaseUrl} />
    </PageContainer>
  );
}
