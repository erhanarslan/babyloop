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
        <h2>Trust & Safety monitoring dashboard</h2>
        <p>
          Aggregate-only operational snapshot for moderation, marketplace review,
          conversations, profiles, audit, and AI health. No seller, reporter,
          message body, email, phone, or raw AI payload is shown.
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
            <SummaryCard label="Open cases" value={summary.moderation.openModerationCases} />
            <SummaryCard label="High priority" value={summary.moderation.openHighPriorityCases} />
            <SummaryCard label="Pending reports" value={summary.moderation.pendingReports} />
            <SummaryCard label="Profiles to review" value={summary.profiles.profilesNeedingReview} />
            <SummaryCard label="Open message cases" value={summary.conversations.openMessageCases} />
            <SummaryCard label="AI failures 7d" value={summary.ai.moderationSummaryFailuresLast7Days} />
            <SummaryCard label="Rejected images" value={summary.images.rejectedListingImages} />
            <SummaryCard label="Audit events 7d" value={summary.actions.auditEventsLast7Days} />
          </section>

          <section className="module-grid" aria-label="Backoffice modules">
            <DashboardModule
              href="/moderation"
              title="Moderation queue"
              description="Track open cases, priority mix, incoming reports, and sensitive-access activity."
              stats={[
                ["Open cases", summary.moderation.openModerationCases],
                ["High priority", summary.moderation.openHighPriorityCases],
                ["Normal priority", summary.moderation.openNormalPriorityCases],
                ["Low priority", summary.moderation.openLowPriorityCases],
                ["New cases 7d", summary.moderation.casesCreatedLast7Days],
                ["Reports 7d", summary.moderation.reportsCreatedLast7Days],
              ]}
            />
            <DashboardModule
              href="/profiles"
              title="Profile risk queue"
              description="Monitor restricted, suspended, high-risk, and critical-risk profiles."
              stats={[
                ["Needs review", summary.profiles.profilesNeedingReview],
                ["Restricted", summary.profiles.restrictedProfiles],
                ["Suspended", summary.profiles.suspendedProfiles],
                ["High risk", summary.profiles.highRiskProfiles],
                ["Critical risk", summary.profiles.criticalRiskProfiles],
              ]}
            />
            <DashboardModule
              href="/conversations"
              title="Message safety"
              description="Review aggregate conversation and message risk without exposing raw message bodies."
              stats={[
                ["Total conversations", summary.conversations.totalConversations],
                ["New conversations 7d", summary.conversations.conversationsCreatedLast7Days],
                ["Messages 7d", summary.conversations.messagesCreatedLast7Days],
                ["Reported messages", summary.conversations.reportedMessageCount],
                ["Open message cases", summary.conversations.openMessageCases],
                ["Message actions 7d", summary.actions.messageEnforcementActionsLast7Days],
              ]}
            />
            <DashboardModule
              href="/listings"
              title="Marketplace review"
              description="Track listing volume, lifecycle state, and image-review backlog signals."
              stats={[
                ["Total listings", summary.listings.totalListings],
                ["Active listings", summary.listings.activeListings],
                ["Created 7d", summary.listings.listingsCreatedLast7Days],
                ["Updated 7d", summary.listings.listingsUpdatedLast7Days],
                ["With rejected images", summary.listings.listingsWithRejectedImages],
                ["Listing actions 7d", summary.actions.listingActionsLast7Days],
              ]}
            />
            <DashboardModule
              href="/listings"
              title="Image review"
              description="Track approved/rejected listing images and recent review action volume."
              stats={[
                ["Total images", summary.images.totalListingImages],
                ["Approved", summary.images.approvedListingImages],
                ["Rejected", summary.images.rejectedListingImages],
                ["Reviewed 7d", summary.images.imagesReviewedLast7Days],
                ["Image actions 7d", summary.actions.imageReviewActionsLast7Days],
              ]}
            />
            <DashboardModule
              href="/audit"
              title="Audit and sensitive access"
              description="Monitor audited admin activity at an aggregate level only."
              stats={[
                ["Audit events 7d", summary.actions.auditEventsLast7Days],
                ["Sensitive grants 7d", summary.moderation.sensitiveAccessGrantedLast7Days],
                ["Sensitive denials 7d", summary.moderation.sensitiveAccessDeniedLast7Days],
                ["Profile actions 7d", summary.actions.profileEnforcementActionsLast7Days],
              ]}
            />
            <DashboardModule
              href="/ai-ops"
              title="AI moderation health"
              description="Monitor AI moderation summary usage and failure signals without showing raw prompts or outputs."
              stats={[
                ["Summary runs 7d", summary.ai.moderationSummaryRunsLast7Days],
                ["Failures 7d", summary.ai.moderationSummaryFailuresLast7Days],
                ["Provider failures 7d", summary.ai.providerFailuresLast7Days],
                ["Validation failures 7d", summary.ai.validationFailuresLast7Days],
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
