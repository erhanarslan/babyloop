"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminDashboardSummary,
  getAdminDashboardSummary,
} from "./api";

export function DashboardHome() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSummary() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminDashboardSummary();

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setSummary(null);
        setErrorMessage(
          getApiErrorMessage(response, "Could not load dashboard summary."),
        );
        setIsLoading(false);
        return;
      }

      setSummary(response.data.summary);
      setIsLoading(false);
    }

    void loadSummary();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">BabyLoop Operations</p>
        <h2>Marketplace review dashboard</h2>
        <p>
          Aggregate-only operational snapshot for listings, images, moderation,
          and admin actions. No seller, reporter, or message identities are shown.
        </p>
      </section>

      {isLoading ? <div className="state-panel">Loading dashboard...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="Dashboard summary">
            <SummaryCard label="Total listings" value={summary.listings.totalListings} />
            <SummaryCard label="Active" value={summary.listings.activeListings} />
            <SummaryCard label="Archived" value={summary.listings.archivedListings} />
            <SummaryCard label="Rejected images" value={summary.images.rejectedListingImages} />
            <SummaryCard label="Open cases" value={summary.moderation.openModerationCases} />
            <SummaryCard label="Suspended profiles" value={summary.profiles.suspendedProfiles} />
          </section>

          <section className="module-grid" aria-label="Backoffice modules">
            <DashboardModule
              href="/listings"
              title="Listing operations"
              description="Review marketplace listings, image review status, and listing-scoped actions."
              stats={[
                ["Created in 7 days", summary.listings.listingsCreatedLast7Days],
                ["Updated in 7 days", summary.listings.listingsUpdatedLast7Days],
                ["With rejected images", summary.listings.listingsWithRejectedImages],
              ]}
            />
            <DashboardModule
              href="/listings"
              title="Image review"
              description="Track approved/rejected listing images and recent review action volume."
              stats={[
                ["Total images", summary.images.totalListingImages],
                ["Approved", summary.images.approvedListingImages],
                ["Reviewed in 7 days", summary.images.imagesReviewedLast7Days],
              ]}
            />
            <DashboardModule
              href="/moderation"
              title="Moderation"
              description="Triage report-driven moderation cases without exposing raw sensitive data."
              stats={[
                ["Total cases", summary.moderation.totalModerationCases],
                ["Created in 7 days", summary.moderation.casesCreatedLast7Days],
                ["Closed", summary.moderation.closedModerationCases],
              ]}
            />
            <DashboardModule
              href="/moderation"
              title="Sensitive access and actions"
              description="Monitor audited admin activity at an aggregate level only."
              stats={[
                ["Listing actions 7d", summary.actions.listingActionsLast7Days],
                ["Image reviews 7d", summary.actions.imageReviewActionsLast7Days],
                ["Denied sensitive 7d", summary.moderation.sensitiveAccessDeniedLast7Days],
              ]}
            />
            <DashboardModule
              href="/audit"
              title="Audit events"
              description="Browse safe audit metadata without exposing raw reasons, contact data, or message bodies."
              stats={[
                ["Audit events 7d", summary.actions.auditEventsLast7Days],
                ["Profile actions 7d", summary.actions.profileEnforcementActionsLast7Days],
                ["Restricted profiles", summary.profiles.restrictedProfiles],
              ]}
            />
          </section>
        </>
      ) : null}
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DashboardModule({
  description,
  href,
  stats,
  title,
}: {
  description: string;
  href: string;
  stats: Array<[string, number]>;
  title: string;
}) {
  return (
    <Link className="module-card dashboard-module-card" href={href}>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <dl className="compact-details">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.message ?? fallback;
}
