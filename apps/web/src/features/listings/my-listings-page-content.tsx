"use client";

import Link from "next/link";

import { Card, PageContainer, PageHeading } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { MyListingsList } from "./my-listings-list";

type MyListingsPageContentProps = {
  apiBaseUrl: string;
};

const sellerOperations = [
  {
    title: "Review",
    body: "Check public listing quality, price, photos, and buyer-facing clarity before changing status."
  },
  {
    title: "Update",
    body: "Refresh price or title when the listing receives interest, ages out, or needs stronger context."
  },
  {
    title: "Close",
    body: "Move listings through reserved, sold, and archived states so buyers see accurate availability."
  }
];

export function MyListingsPageContent({ apiBaseUrl }: MyListingsPageContentProps) {
  const { dictionary } = useI18n();

  return (
    <>
      <PageHeading
        eyebrow={dictionary.listings.myListingsEyebrow}
        title={dictionary.listings.myListingsTitle}
        description={dictionary.listings.myListingsDescription}
      />

      <PageContainer className="seller-ops-layout listing-column" ariaLabel={dictionary.listings.myListingsAriaLabel}>
        <Card as="section" className="seller-ops-hero" aria-label="Seller listing management overview">
          <div>
            <p className="eyebrow">Seller operations</p>
            <h2>Manage listing quality, availability, and buyer trust from one workspace.</h2>
            <p>
              Keep public listings accurate, upload clearer photos, adjust price/title when needed,
              and move items through reserved, sold, and archived states without exposing private contact details.
            </p>
            <div className="seller-ops-actions">
              <Link href="/sell">Create listing</Link>
              <Link href="/account/seller">Seller dashboard</Link>
              <Link href="/assistant?mode=sell_help&prompt=Help%20me%20improve%20my%20BabyLoop%20seller%20listings.">
                Ask seller assistant
              </Link>
            </div>
          </div>

          <aside className="seller-ops-principles" aria-label="Seller operations principles">
            <div>
              <span>Accuracy</span>
              <strong>Status must match real availability</strong>
            </div>
            <div>
              <span>Trust</span>
              <strong>Photos and condition notes reduce buyer friction</strong>
            </div>
            <div>
              <span>Privacy</span>
              <strong>Public listings do not need phone or address data</strong>
            </div>
          </aside>
        </Card>

        <section className="seller-ops-grid" aria-label="Seller operations workflow">
          {sellerOperations.map((operation, index) => (
            <Card as="article" className="seller-ops-card" key={operation.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{operation.title}</h2>
              <p>{operation.body}</p>
            </Card>
          ))}
        </section>

        <MyListingsList apiBaseUrl={apiBaseUrl} />
      </PageContainer>
    </>
  );
}
