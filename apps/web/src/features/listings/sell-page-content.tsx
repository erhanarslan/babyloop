import Link from "next/link";
"use client";

import { Alert, Card, PageContainer, PageHeading } from "../../components/ui";
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
    <>
      <PageHeading
        eyebrow={dictionary.listings.sellEyebrow}
        title={dictionary.listings.sellTitle}
        description={dictionary.listings.sellDescription}
      />

      <PageContainer className="sell-layout" ariaLabel={dictionary.listings.createAriaLabel}>
        {error ? (
          <Alert
            title={dictionary.listings.listingsUnavailable}
            message={getApiErrorMessage(error, dictionary)}
          />
        ) : null}

        <Card as="section" className="seller-insight-callout">
          <div>
            <p className="eyebrow">Seller guide</p>
            <h2>Use AI, but keep the final decision yours</h2>
            <p className="form-note">
              BabyLoop can suggest title, description, category, condition, and price. Review everything before publishing and avoid unnecessary personal data.
            </p>
          </div>
          <div className="home-personalization-actions">
            <Link href="/guides">Parent guides</Link>
            <Link href="/account/seller">Seller dashboard</Link>
          </div>
        </Card>

        <Card className="form-panel">
          <SellListingForm categories={categories} apiBaseUrl={apiBaseUrl} />
        </Card>
      </PageContainer>
    </>
  );
}
