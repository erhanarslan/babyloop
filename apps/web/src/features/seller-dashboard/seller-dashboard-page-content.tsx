"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  EmptyState,
  LoadingBlock,
  PageContainer,
  PageHeading
} from "../../components/ui";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  fetchSellerDashboard,
  type SellerDashboardSummary
} from "./api";

type SellerDashboardPageContentProps = {
  apiBaseUrl: string;
};

export function SellerDashboardPageContent({ apiBaseUrl }: SellerDashboardPageContentProps) {
  const { dictionary } = useI18n();
  const { isCheckingAuth } = useProtectedRoute({ apiBaseUrl });
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    let isActive = true;

    async function loadSellerDashboard() {
      const response = await fetchSellerDashboard(apiBaseUrl);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error as ApiError, dictionary));
        setSummary(null);
        return;
      }

      setSummary(response.data.summary);
    }

    void loadSellerDashboard();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary, isCheckingAuth]);

  return (
    <>
      <PageHeading
        eyebrow="Seller dashboard"
        title="Your listing performance"
        description="Aggregate-only listing insights. Buyer identity, message bodies, and contact details are not shown."
      />

      <PageContainer className="listing-column" ariaLabel="Seller dashboard">
        {errorMessage ? (
          <Alert title="Seller dashboard unavailable" message={errorMessage} />
        ) : null}

        {isCheckingAuth || !summary ? (
          <LoadingBlock title="Loading seller dashboard" message="Preparing your listing insights." />
        ) : null}

        {summary ? (
          <>
            <section className="summary-grid">
              <SummaryCard label="Listings" value={summary.totals.totalListings} />
              <SummaryCard label="Active" value={summary.totals.activeListings} />
              <SummaryCard label="Reserved" value={summary.totals.reservedListings} />
              <SummaryCard label="Sold" value={summary.totals.soldListings} />
              <SummaryCard label="Favorites" value={summary.totals.totalFavorites} />
              <SummaryCard label="Detail views" value={summary.totals.listingDetailViews} />
              <SummaryCard label="Listing clicks" value={summary.totals.listingClicks} />
              <SummaryCard label="Contact intents" value={summary.totals.contactSellerIntents} />
            </section>

            {summary.listings.length === 0 ? (
              <EmptyState
                title="No seller listings yet"
                message="Create your first listing to start collecting seller insights."
                actionHref="/sell"
                actionLabel="Create listing"
              />
            ) : null}

            {summary.listings.length > 0 ? (
              <section className="listing-column" aria-label="Seller listing stats">
                {summary.listings.map((listing) => (
                  <Card as="article" className="form-panel" key={listing.listingId}>
                    <div className="form-actions">
                      <div>
                        <h2>{listing.title}</h2>
                        <p className="form-note">
                          {listing.categoryName} · {listing.status} · Created {new Date(listing.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Link href={`/listings/${listing.listingId}`}>Open listing</Link>
                    </div>
                    <dl className="compact-details">
                      <div>
                        <dt>Favorites</dt>
                        <dd>{listing.favoriteCount}</dd>
                      </div>
                      <div>
                        <dt>Detail views</dt>
                        <dd>{listing.detailViews}</dd>
                      </div>
                      <div>
                        <dt>Listing clicks</dt>
                        <dd>{listing.listingClicks}</dd>
                      </div>
                      <div>
                        <dt>Contact intents</dt>
                        <dd>{listing.contactSellerIntents}</dd>
                      </div>
                    </dl>
                  </Card>
                ))}
              </section>
            ) : null}
          </>
        ) : null}
      </PageContainer>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card as="article" className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}
