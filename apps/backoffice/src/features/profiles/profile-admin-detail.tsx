"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminProfileDetail,
  getAdminProfile,
} from "./api";

export function ProfileAdminDetail({ profileId }: { profileId: string }) {
  const [profile, setProfile] = useState<AdminProfileDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminProfile(profileId);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setProfile(null);
        setErrorMessage(getApiErrorMessage(response, "Could not load profile."));
        setIsLoading(false);
        return;
      }

      setProfile(response.data.profile);
      setIsLoading(false);
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [profileId]);

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">Trust & Safety</p>
          <h2>Profile detail</h2>
          <p>
            Privacy-safe profile operations view. Email, phone, raw user records,
            raw report details, and message bodies are not shown here.
          </p>
        </div>
        <Link className="secondary-action" href="/profiles">
          Back to profiles
        </Link>
      </div>

      {isLoading ? <div className="state-panel">Loading profile...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {profile ? <ProfileDetailContent profile={profile} /> : null}
    </section>
  );
}

function ProfileDetailContent({ profile }: { profile: AdminProfileDetail }) {
  const snapshot = profile.trustSnapshot;
  const riskLevel = snapshot?.riskLevel ?? "low";

  return (
    <div className="profile-detail-layout">
      <section className="profile-detail-card">
        <div className="profile-admin-card-header">
          <div>
            <strong>{profile.displayName}</strong>
            <p>{profile.locationCity ?? "Location not provided"}</p>
          </div>
          <span className={`risk-pill ${riskLevel}`}>{formatStatus(riskLevel)}</span>
        </div>

        <dl className="compact-details">
          <div>
            <dt>Profile ID</dt>
            <dd>{profile.profileId}</dd>
          </div>
          <div>
            <dt>Safety status</dt>
            <dd>{formatStatus(profile.safetyStatus)}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDateTime(profile.createdAt)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatDateTime(profile.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="profile-detail-card">
        <h3>Trust snapshot</h3>
        {snapshot ? (
          <>
            <dl className="compact-details">
              <div>
                <dt>Trust score</dt>
                <dd>{snapshot.trustScore}</dd>
              </div>
              <div>
                <dt>Risk score</dt>
                <dd>{snapshot.riskScore}</dd>
              </div>
              <div>
                <dt>Risk level</dt>
                <dd>{formatStatus(snapshot.riskLevel)}</dd>
              </div>
              <div>
                <dt>Open cases</dt>
                <dd>{snapshot.openCaseCount}</dd>
              </div>
              <div>
                <dt>Recent reports</dt>
                <dd>{snapshot.recentReportCount}</dd>
              </div>
              <div>
                <dt>Recent enforcement</dt>
                <dd>{snapshot.recentEnforcementCount}</dd>
              </div>
              <div>
                <dt>Sensitive access</dt>
                <dd>{snapshot.sensitiveAccessCount}</dd>
              </div>
              <div>
                <dt>AI summaries</dt>
                <dd>{snapshot.aiSummaryCount}</dd>
              </div>
            </dl>
            <p className="muted">Computed {formatDateTime(snapshot.computedAt)}</p>
          </>
        ) : (
          <p className="muted">No trust snapshot has been computed for this profile yet.</p>
        )}
      </section>

      <section className="profile-detail-card">
        <h3>Operational stats</h3>
        <dl className="compact-details">
          <div>
            <dt>Total listings</dt>
            <dd>{profile.stats.totalListings}</dd>
          </div>
          <div>
            <dt>Active listings</dt>
            <dd>{profile.stats.activeListings}</dd>
          </div>
          <div>
            <dt>Archived listings</dt>
            <dd>{profile.stats.archivedListings}</dd>
          </div>
          <div>
            <dt>Sold listings</dt>
            <dd>{profile.stats.soldListings}</dd>
          </div>
          <div>
            <dt>Related cases</dt>
            <dd>{profile.stats.totalCases}</dd>
          </div>
          <div>
            <dt>Open cases</dt>
            <dd>{profile.stats.openCases}</dd>
          </div>
          <div>
            <dt>Enforcement actions</dt>
            <dd>{profile.stats.enforcementActions}</dd>
          </div>
        </dl>
      </section>

      <section className="profile-detail-card wide">
        <h3>Recent listings</h3>
        {profile.listings.length > 0 ? (
          <div className="table-list">
            {profile.listings.map((listing) => (
              <article className="table-list-row" key={listing.listingId}>
                <div>
                  <Link href={`/listings/${listing.listingId}`}>{listing.title}</Link>
                  <p className="muted">
                    {listing.category.name} · {formatStatus(listing.status)} · {formatStatus(listing.condition)}
                  </p>
                </div>
                <span>{listing.price ? `${listing.price.amount} ${listing.price.currency}` : "No price"}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No listings found for this profile.</p>
        )}
      </section>

      <section className="profile-detail-card wide">
        <h3>Related moderation cases</h3>
        {profile.relatedModerationCases.length > 0 ? (
          <div className="table-list">
            {profile.relatedModerationCases.map((item) => (
              <article className="table-list-row" key={item.caseId}>
                <div>
                  <Link href={`/moderation/${item.caseId}`}>Case {item.caseId.slice(0, 8)}</Link>
                  <p className="muted">
                    {formatStatus(item.targetType)} · {formatStatus(item.status)} · {formatStatus(item.priority)}
                  </p>
                </div>
                <span>{item.reason ? formatStatus(item.reason) : "No report reason"}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No related moderation cases found.</p>
        )}
      </section>

      <section className="profile-detail-card wide">
        <h3>Enforcement history</h3>
        {profile.enforcementHistory.length > 0 ? (
          <div className="table-list">
            {profile.enforcementHistory.map((item) => (
              <article className="table-list-row" key={item.actionId}>
                <div>
                  <strong>{formatStatus(item.actionType)}</strong>
                  <p className="muted">{formatDateTime(item.createdAt)}</p>
                </div>
                {item.caseId ? <Link href={`/moderation/${item.caseId}`}>Open case</Link> : <span>No case</span>}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No enforcement actions found for related cases.</p>
        )}
      </section>
    </div>
  );
}

function formatStatus(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  return response.ok ? fallback : response.error.message;
}
