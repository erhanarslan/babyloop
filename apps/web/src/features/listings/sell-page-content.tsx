"use client";

import { Alert, Card, PageContainer } from "../../components/ui";
import type { Category } from "../../lib/api";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { SellListingForm } from "./sell-listing-form";

type SellPageContentProps = {
  apiBaseUrl: string;
  categories: Category[];
  error: ApiError | null;
};

export function SellPageContent({
  apiBaseUrl,
  categories,
  error
}: SellPageContentProps) {
  const { dictionary } = useI18n();

  return (
    <PageContainer className="sell-layout" ariaLabel="İlan oluştur">
      <section className="mb-4 sm:mb-5">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          İlan Oluştur
        </h1>
      </section>

      {error ? (
        <Alert
          title={dictionary.listings.listingsUnavailable}
          message={getApiErrorMessage(error, dictionary)}
        />
      ) : null}

      <Card className="form-panel sell-form-panel">
        <SellListingForm categories={categories} apiBaseUrl={apiBaseUrl} />
      </Card>
    </PageContainer>
  );
}
