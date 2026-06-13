"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageContainer,
  PageHeading,
  Select,
  TextInput
} from "../../components/ui";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  createChildProfile,
  deleteChildProfile,
  fetchChildProfiles,
  fetchLifecycleRecommendations,
  updateChildProfile,
  type ChildAgeBand,
  type ChildProfile,
  type LifecycleRecommendationGroup
} from "./api";

type ChildProfilesPageContentProps = {
  apiBaseUrl: string;
};

const AGE_BAND_OPTIONS: Array<{ label: string; value: ChildAgeBand }> = [
  { label: "Expecting", value: "expecting" },
  { label: "0-3 months", value: "newborn_0_3" },
  { label: "3-6 months", value: "infant_3_6" },
  { label: "6-12 months", value: "infant_6_12" },
  { label: "12-24 months", value: "toddler_12_24" },
  { label: "24-36 months", value: "preschool_24_36" },
  { label: "3+ years", value: "child_3_plus" }
];

export function ChildProfilesPageContent({ apiBaseUrl }: ChildProfilesPageContentProps) {
  const { dictionary } = useI18n();
  const { isCheckingAuth, requireAuth } = useProtectedRoute({ apiBaseUrl });
  const [childProfiles, setChildProfiles] = useState<ChildProfile[]>([]);
  const [recommendationGroups, setRecommendationGroups] = useState<LifecycleRecommendationGroup[]>([]);
  const [label, setLabel] = useState("Child profile");
  const [ageBand, setAgeBand] = useState<ChildAgeBand>("infant_6_12");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadChildProfileData = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    const [childProfilesResponse, recommendationsResponse] = await Promise.all([
      fetchChildProfiles(apiBaseUrl),
      fetchLifecycleRecommendations(apiBaseUrl)
    ]);

    if (!childProfilesResponse.ok) {
      setMessage({
        tone: "error",
        text: getApiErrorMessage(childProfilesResponse.error as ApiError, dictionary)
      });
      setIsLoading(false);
      return;
    }

    setChildProfiles(childProfilesResponse.data.childProfiles);
    setRecommendationGroups(recommendationsResponse.ok ? recommendationsResponse.data.groups : []);
    setIsLoading(false);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    void loadChildProfileData();
  }, [isCheckingAuth, loadChildProfileData]);

  async function handleCreateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const isAuthenticated = await requireAuth();

    if (!isAuthenticated) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await createChildProfile(apiBaseUrl, {
      label,
      ageBand,
      isActive: true
    });

    if (!response.ok) {
      setMessage({
        tone: "error",
        text: getApiErrorMessage(response.error as ApiError, dictionary)
      });
      setIsSubmitting(false);
      return;
    }

    setLabel("Child profile");
    setAgeBand("infant_6_12");
    await loadChildProfileData();
    setMessage({ tone: "info", text: "Child profile saved." });
    setIsSubmitting(false);
  }

  async function handleToggleActive(childProfile: ChildProfile) {
    const response = await updateChildProfile(apiBaseUrl, childProfile.id, {
      isActive: !childProfile.isActive
    });

    if (!response.ok) {
      setMessage({
        tone: "error",
        text: getApiErrorMessage(response.error as ApiError, dictionary)
      });
      return;
    }

    await loadChildProfileData();
  }

  async function handleDelete(childProfile: ChildProfile) {
    const response = await deleteChildProfile(apiBaseUrl, childProfile.id);

    if (!response.ok) {
      setMessage({
        tone: "error",
        text: getApiErrorMessage(response.error as ApiError, dictionary)
      });
      return;
    }

    await loadChildProfileData();
  }

  return (
    <>
      <PageHeading
        eyebrow="Family profile"
        title="Child profiles"
        description="Save privacy-light age bands to receive a stage-based upcoming needs list. BabyLoop stores age bands, not exact birth dates."
      />

      <PageContainer className="listing-column" ariaLabel="Child profiles">
        {message ? (
          <Alert
            title={message.tone === "error" ? "Child profile action failed" : "Child profile updated"}
            message={message.text}
            tone={message.tone}
          />
        ) : null}

        <Card as="section" className="form-panel">
          <form className="listing-form" onSubmit={handleCreateProfile}>
            <div>
              <p className="eyebrow">Lifecycle setup</p>
              <h2>Add a child age band</h2>
              <p className="form-note">
                Use a generic label such as “Baby 1”. Avoid exact names or birth dates if you do not need them.
              </p>
            </div>

            <div className="form-grid">
              <TextInput
                label="Profile label"
                maxLength={80}
                onChange={(event) => setLabel(event.target.value)}
                required
                value={label}
              />
              <Select
                label="Age band"
                onChange={(event) => setAgeBand(event.target.value as ChildAgeBand)}
                value={ageBand}
              >
                {AGE_BAND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="form-actions">
              <Button disabled={isSubmitting || isCheckingAuth} type="submit">
                {isSubmitting ? "Saving..." : "Save child profile"}
              </Button>
              <p className="form-note">
                Recommendations are grouped by age band and category only.
              </p>
            </div>
          </form>
        </Card>

        {isLoading || isCheckingAuth ? (
          <LoadingBlock title="Loading child profiles" message="Checking your family profile settings." />
        ) : null}

        {!isLoading && childProfiles.length === 0 ? (
          <EmptyState
            title="No child profiles yet"
            message="Add one age band to unlock lifecycle category suggestions."
          />
        ) : null}

        {childProfiles.length > 0 ? (
          <section className="listing-column" aria-label="Saved child profiles">
            {childProfiles.map((childProfile) => (
              <Card as="article" className="form-panel" key={childProfile.id}>
                <div className="form-actions">
                  <div>
                    <h2>{childProfile.label}</h2>
                    <p className="form-note">{formatAgeBand(childProfile.ageBand)}</p>
                  </div>
                  <Badge tone={childProfile.isActive ? "success" : "warning"}>
                    {childProfile.isActive ? "Active" : "Paused"}
                  </Badge>
                </div>
                <div className="form-actions">
                  <Button type="button" variant="secondary" onClick={() => void handleToggleActive(childProfile)}>
                    {childProfile.isActive ? "Pause recommendations" : "Resume recommendations"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void handleDelete(childProfile)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </section>
        ) : null}

        {recommendationGroups.length > 0 ? (
          <section className="listing-column" aria-label="Upcoming needs plan">
            <div className="section-heading">
              <h2>Upcoming needs plan</h2>
              <p className="muted">
                Stage-based product ideas for parents. These suggestions use age bands only and avoid exact birth dates.
              </p>
            </div>

            {recommendationGroups.map((group) => (
              <Card as="article" className="form-panel" key={group.childProfileId}>
                <div className="form-actions">
                  <div>
                    <p className="eyebrow">{formatAgeBand(group.ageBand)}</p>
                    <h3>{buildParentMilestoneTitle(group)}</h3>
                    <p className="form-note">{buildParentMilestoneDescription(group)}</p>
                  </div>
                  <Badge>{group.recommendations.length} needs</Badge>
                </div>

                <div className="listing-column">
                  {group.recommendations.map((recommendation) => (
                    <div className="panel-row" key={`${group.childProfileId}-${recommendation.categoryId}`}>
                      <div>
                        <strong>{recommendation.categoryName}</strong>
                        <p>{recommendation.whyNow}</p>
                        <p className="form-note">{recommendation.reasonLabel}</p>
                        <p className="ai-debug">
                          {recommendation.reasoningProviderName} · {recommendation.reasoningPromptVersion} · confidence{" "}
                          {formatConfidence(recommendation.reasoningConfidenceScore)}
                        </p>
                      </div>
                      <div className="form-actions">
                        <Link href={`/categories/${recommendation.categorySlug}`}>Browse</Link>
                        <Link href={buildLifecycleBrowseHref(recommendation)}>Search need</Link>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="state-panel warning">
                  This is a marketplace needs guide, not medical, nutrition, or therapy advice. For child-specific health decisions, consult a qualified professional.
                </div>
              </Card>
            ))}
          </section>
        ) : null}
      </PageContainer>
    </>
  );
}

function formatAgeBand(ageBand: ChildAgeBand): string {
  return AGE_BAND_OPTIONS.find((option) => option.value === ageBand)?.label ?? ageBand;
}

function buildParentMilestoneTitle(group: LifecycleRecommendationGroup): string {
  return `${group.childProfileLabel} reached the ${formatAgeBand(group.ageBand)} stage`;
}

function buildParentMilestoneDescription(group: LifecycleRecommendationGroup): string {
  return `Here is a lightweight list of product categories that may become useful around this stage.`;
}

function buildLifecycleBrowseHref(
  recommendation: LifecycleRecommendationGroup["recommendations"][number]
): string {
  const params = new URLSearchParams({
    categoryId: recommendation.categoryId,
    q: recommendation.categoryName,
    sort: "newest"
  });

  return `/browse?${params.toString()}`;
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}
