"use client";

import Link from "next/link";

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

const sellerJourneySteps = [
  {
    title: "Prepare",
    body: "Collect condition notes, included parts, pickup expectations, and clear photos before publishing."
  },
  {
    title: "Enhance",
    body: "Use AI suggestions for structure and pricing, then review every field manually."
  },
  {
    title: "Publish",
    body: "Keep private contact details out of the listing and continue buyer questions inside BabyLoop messaging."
  }
];

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
        <SellerOnboardingHero />

        {error ? (
          <Alert
            title={dictionary.listings.listingsUnavailable}
            message={getApiErrorMessage(error, dictionary)}
          />
        ) : null}

        <section className="sell-support-grid" aria-label="Seller preparation workflow">
          {sellerJourneySteps.map((step, index) => (
            <Card as="article" className="sell-support-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </Card>
          ))}
        </section>

        <Card as="section" className="seller-insight-callout seller-insight-callout-product">
          <div>
            <p className="eyebrow">Seller guide</p>
            <h2>Use AI as a listing co-pilot, not an autopilot</h2>
            <p className="form-note">
              BabyLoop can suggest title, description, category, condition, and price. You keep the final decision,
              confirm real condition, and avoid unnecessary personal data before publishing.
            </p>
          </div>
          <div className="home-personalization-actions">
            <Link href="/guides">Parent guides</Link>
            <Link href="/account/seller">Seller dashboard</Link>
            <Link
              href={buildAssistantHref(
                "sell_help",
                "I want to create a clear BabyLoop listing. What details should I include?"
              )}
            >
              Ask Assistant
            </Link>
          </div>
        </Card>

        <Card className="form-panel sell-form-panel">
          <div className="sell-form-intro">
            <p className="eyebrow">Listing draft workspace</p>
            <h2>Build a listing parents can understand before they message.</h2>
            <p>
              Start with the required product facts, add photos, use AI only where useful,
              then publish after the final seller checklist.
            </p>
          </div>
          <SellListingForm categories={categories} apiBaseUrl={apiBaseUrl} />
        </Card>
      </PageContainer>
    </>
  );
}

function SellerOnboardingHero() {
  return (
    <Card as="section" className="sell-onboarding-hero" aria-label="Sell on BabyLoop overview">
      <div>
        <p className="eyebrow">Seller onboarding</p>
        <h2>Turn outgrown baby essentials into clear, trusted listings.</h2>
        <p>
          Create a parent-friendly listing with condition notes, photos, pickup context,
          AI-assisted drafting, price guidance, and privacy-safe marketplace rules.
        </p>
        <div className="sell-hero-actions">
          <Link href="/account/seller">Open seller dashboard</Link>
          <Link href="/my-listings">Manage my listings</Link>
          <Link href="/assistant?mode=sell_help&prompt=Help%20me%20prepare%20a%20clear%20BabyLoop%20listing.">
            Ask seller assistant
          </Link>
        </div>
      </div>

      <aside className="sell-hero-metrics" aria-label="Seller flow summary">
        <div>
          <span>Images</span>
          <strong>Up to 5</strong>
        </div>
        <div>
          <span>AI help</span>
          <strong>Draft + price</strong>
        </div>
        <div>
          <span>Privacy</span>
          <strong>No contact data needed</strong>
        </div>
      </aside>
    </Card>
  );
}

type AssistantEntryMode = "age_needs" | "find_products" | "sell_help" | "safe_buying" | "platform_help";

function buildAssistantHref(mode: AssistantEntryMode, prompt: string): string {
  const params = new URLSearchParams({
    mode,
    prompt
  });

  return `/assistant?${params.toString()}`;
}
