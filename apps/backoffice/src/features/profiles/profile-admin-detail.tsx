"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminProfileDetail,
  type AdminProfileEnforcementAction,
  type ViewerProfile,
  applyAdminProfileEnforcement,
  getAdminProfile,
} from "./api";
import { useBackofficeAccess } from "../auth/backoffice-access";

export function ProfileAdminDetail({ profileId }: { profileId: string }) {
  const access = useBackofficeAccess();
  const [profile, setProfile] = useState<AdminProfileDetail | ViewerProfile | null>(null);
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

      {profile ? (
        <ProfileDetailContent
          canMutate={access.can("mutate")}
          onProfileUpdated={setProfile}
          profile={profile}
        />
      ) : null}
    </section>
  );
}

function ProfileDetailContent({
  canMutate,
  onProfileUpdated,
  profile,
}: {
  canMutate: boolean;
  onProfileUpdated: (profile: AdminProfileDetail | ViewerProfile) => void;
  profile: AdminProfileDetail | ViewerProfile;
}) {
  if (!("trustSnapshot" in profile)) {
    return <ViewerProfileDetailContent profile={profile} />;
  }

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

      {canMutate ? (
        <ProfileEnforcementControls
          onProfileUpdated={onProfileUpdated}
          profile={profile}
        />
      ) : null}

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

function ViewerProfileDetailContent({ profile }: { profile: ViewerProfile }) {
  return (
    <div className="profile-detail-layout">
      <section className="profile-detail-card">
        <div className="profile-admin-card-header">
          <div>
            <strong>{profile.displayName}</strong>
            <p>{profile.locationCity ?? "Location not provided"}</p>
          </div>
        </div>
        <dl className="compact-details">
          <div>
            <dt>Profile ID</dt>
            <dd>{profile.profileId}</dd>
          </div>
          <div>
            <dt>Listings</dt>
            <dd>{profile.listingCount}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDateTime(profile.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

type ProfileEnforcementOption = {
  action: AdminProfileEnforcementAction;
  label: string;
  description: string;
};

const profileEnforcementOptions: ProfileEnforcementOption[] = [
  {
    action: "profile_warn",
    label: "Warn profile",
    description: "Record a warning without changing the profile safety status."
  },
  {
    action: "profile_restrict",
    label: "Restrict profile",
    description: "Prevent listing creation and messaging while keeping profile records visible to admins."
  },
  {
    action: "profile_suspend",
    label: "Suspend profile",
    description: "Block marketplace activity and hide the seller's public listings."
  },
  {
    action: "profile_restore",
    label: "Restore profile",
    description: "Return the profile to active marketplace status."
  }
];

function ProfileEnforcementControls({
  onProfileUpdated,
  profile,
}: {
  onProfileUpdated: (profile: AdminProfileDetail) => void;
  profile: AdminProfileDetail;
}) {
  const [selectedAction, setSelectedAction] = useState<AdminProfileEnforcementAction>(
    "profile_warn"
  );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10) {
      setErrorMessage("Enter a reason with at least 10 characters.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setErrorMessage(null);

    const response = await applyAdminProfileEnforcement(profile.profileId, {
      action: selectedAction,
      reason: trimmedReason,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response, "Could not apply profile enforcement."));
      return;
    }

    onProfileUpdated(response.data.profile);
    setReason("");
    setFeedback(
      `Profile enforcement applied. Audit event id: ${response.data.enforcement.auditEventId}`
    );
  }

  return (
    <form className="profile-detail-card enforcement-card" onSubmit={handleSubmit}>
      <div>
        <h3>Profile enforcement</h3>
        <p className="muted">
          Apply profile-level Trust & Safety actions directly from this detail page.
          A reason is required. The action is audited and does not expose raw reports,
          reporter identity, message bodies, email, or phone data.
        </p>
      </div>

      <fieldset className="checkbox-group">
        <legend>Action</legend>
        {profileEnforcementOptions.map((option) => (
          <label className="checkbox-option" key={option.action}>
            <input
              checked={selectedAction === option.action}
              disabled={isSubmitting}
              name="profile-enforcement-action"
              onChange={() => setSelectedAction(option.action)}
              type="radio"
              value={option.action}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="form-field">
        <span>Enforcement reason</span>
        <textarea
          disabled={isSubmitting}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain why this profile-level action is necessary. Avoid unnecessary personal data."
          rows={4}
          value={reason}
        />
      </label>

      <div className="state-panel warning">
        Current profile safety status: {formatStatus(profile.safetyStatus)}.
        Repeating the same state transition is rejected by the API.
      </div>

      {feedback ? <p className="form-success">{feedback}</p> : null}
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="primary-action"
        disabled={isSubmitting || reason.trim().length < 10}
        type="submit"
      >
        {isSubmitting ? "Applying..." : "Apply profile enforcement"}
      </button>
    </form>
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
