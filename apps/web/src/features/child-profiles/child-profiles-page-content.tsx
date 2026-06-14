"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
import { getGuideTopicsForAgeBand } from "../parent-guides/parent-guide-data";
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

type LifecycleRecommendation = LifecycleRecommendationGroup["recommendations"][number];

const AGE_BAND_OPTIONS: Array<{ label: string; value: ChildAgeBand }> = [
  { label: "Expecting", value: "expecting" },
  { label: "0-3 months", value: "newborn_0_3" },
  { label: "3-6 months", value: "infant_3_6" },
  { label: "6-12 months", value: "infant_6_12" },
  { label: "12-24 months", value: "toddler_12_24" },
  { label: "24-36 months", value: "preschool_24_36" },
  { label: "3+ years", value: "child_3_plus" }
];

const planningSteps = [
  {
    title: "Profile",
    body: "Save only a privacy-light label and age band. Exact names and birth dates are not needed for marketplace planning."
  },
  {
    title: "Plan",
    body: "Use lifecycle categories to understand upcoming marketplace needs by stage, season, and family routine."
  },
  {
    title: "Act",
    body: "Open categories, create saved searches, read guides, or ask the assistant for a safer buying checklist."
  }
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
  }, [apiBaseUrl, dictionary]);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    void loadChildProfileData();
  }, [isCheckingAuth, loadChildProfileData]);

  const profileMetrics = useMemo(
    () => buildProfileMetrics(childProfiles, recommendationGroups),
    [childProfiles, recommendationGroups]
  );
  const activeRecommendationGroups = useMemo(
    () => recommendationGroups.filter((group) => group.recommendations.length > 0),
    [recommendationGroups]
  );
  const guideTopics = useMemo(
    () => getGuideTopicsForProfiles(childProfiles, ageBand),
    [ageBand, childProfiles]
  );

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
        eyebrow="Family planning"
        title="Child profile recommendations"
        description="Save privacy-light age bands to connect marketplace categories, saved searches, parent guides, and assistant prompts without storing exact birth dates."
      />

      <PageContainer className="child-profile-layout listing-column" ariaLabel="Child profiles">
        <ChildProfilesHero />

        <section className="child-planning-grid" aria-label="Child profile planning workflow">
          {planningSteps.map((step, index) => (
            <Card as="article" className="child-planning-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </Card>
          ))}
        </section>

        {message ? (
          <Alert
            title={message.tone === "error" ? "Child profile action failed" : "Child profile updated"}
            message={message.text}
            tone={message.tone}
          />
        ) : null}

        <ChildProfileOverview metrics={profileMetrics} />

        <Card as="section" className="child-profile-form-panel">
          <form className="listing-form" onSubmit={handleCreateProfile}>
            <div>
              <p className="eyebrow">Lifecycle setup</p>
              <h2>Add a privacy-light age band</h2>
              <p className="form-note">
                Use a generic label such as “Baby 1”. Avoid exact names, birth dates, health details, or sensitive personal notes.
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

            <div className="child-profile-form-actions">
              <Button disabled={isSubmitting || isCheckingAuth} type="submit">
                {isSubmitting ? "Saving..." : "Save child profile"}
              </Button>
              <Link
                href={buildAssistantHref(
                  "age_needs",
                  `I am setting up a ${formatAgeBand(ageBand)} child profile. What BabyLoop marketplace needs should I plan for?`
                )}
              >
                Ask Assistant
              </Link>
              <Link href="/account/saved-searches">Saved searches</Link>
            </div>

            <p className="form-note">
              Recommendations are grouped by age band and marketplace category only.
            </p>
          </form>
        </Card>

        {isLoading || isCheckingAuth ? (
          <LoadingBlock title="Loading child profiles" message="Checking your family profile settings." />
        ) : null}

        {!isLoading && childProfiles.length === 0 ? (
          <EmptyState
            title="No child profiles yet"
            message="Add one age band to unlock lifecycle category suggestions and parent guide topics."
            actionHref="/account/children"
            actionLabel="Add age band"
          />
        ) : null}

        {childProfiles.length > 0 ? (
          <section className="child-profile-workspace" aria-label="Saved child profiles">
            <div className="section-heading">
              <h2>Age-band profiles</h2>
              <p className="muted">
                Active profiles power lifecycle recommendations. Paused profiles stay saved but do not need immediate planning attention.
              </p>
            </div>

            <div className="child-profile-card-grid">
              {childProfiles.map((childProfile) => (
                <ChildProfileCard
                  childProfile={childProfile}
                  key={childProfile.id}
                  onDelete={() => void handleDelete(childProfile)}
                  onToggleActive={() => void handleToggleActive(childProfile)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {activeRecommendationGroups.length > 0 ? (
          <section className="child-profile-workspace" aria-label="Upcoming needs plan">
            <div className="section-heading">
              <h2>Upcoming needs plan</h2>
              <p className="muted">
                Stage-based marketplace ideas using age bands only. This is product planning, not medical, nutrition, or therapy advice.
              </p>
            </div>

            <div className="lifecycle-recommendation-grid">
              {activeRecommendationGroups.map((group) => (
                <LifecycleRecommendationGroupCard group={group} key={group.childProfileId} />
              ))}
            </div>
          </section>
        ) : null}

        {guideTopics.length > 0 ? (
          <ParentGuideTopicsSection topics={guideTopics} />
        ) : null}
      </PageContainer>
    </>
  );
}

function ChildProfilesHero() {
  return (
    <Card as="section" className="child-profile-hero" aria-label="Child profile recommendations overview">
      <div>
        <p className="eyebrow">Privacy-light planning</p>
        <h2>Plan around age bands, not exact personal details.</h2>
        <p>
          BabyLoop child profiles connect upcoming marketplace needs with categories, saved searches,
          parent guides, and assistant prompts while avoiding exact birth dates and sensitive child data.
        </p>
        <div className="child-profile-hero-actions">
          <Link href="/browse">Browse needs</Link>
          <Link href="/account/saved-searches">Saved searches</Link>
          <Link href="/guides">Parent guides</Link>
          <Link href="/assistant?mode=age_needs&prompt=Help%20me%20plan%20BabyLoop%20needs%20by%20child%20age%20band.">
            Ask age-band assistant
          </Link>
        </div>
      </div>

      <aside className="child-profile-principles" aria-label="Child profile principles">
        <div>
          <span>Stored</span>
          <strong>Generic label + age band</strong>
        </div>
        <div>
          <span>Not stored</span>
          <strong>Exact birth date or health details</strong>
        </div>
        <div>
          <span>Output</span>
          <strong>Marketplace needs and guides</strong>
        </div>
      </aside>
    </Card>
  );
}

function ChildProfileOverview({
  metrics
}: {
  metrics: ReturnType<typeof buildProfileMetrics>;
}) {
  return (
    <Card as="section" className="child-profile-overview" aria-label="Child profile summary">
      <div>
        <p className="eyebrow">Family planning summary</p>
        <h2>Keep recommendations useful and low-risk</h2>
        <p>
          Use active profiles for current planning, pause profiles when a stage is no longer relevant,
          and convert useful recommendations into category browsing or saved searches.
        </p>
      </div>

      <div className="child-profile-metrics">
        <MetricCard label="Profiles" value={metrics.totalProfiles} />
        <MetricCard label="Active" value={metrics.activeProfiles} />
        <MetricCard label="Paused" value={metrics.pausedProfiles} />
        <MetricCard label="Needs" value={metrics.recommendationCount} />
        <MetricCard label="Stages" value={metrics.ageBandCount} />
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="child-profile-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChildProfileCard({
  childProfile,
  onDelete,
  onToggleActive
}: {
  childProfile: ChildProfile;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  return (
    <Card as="article" className="child-profile-card">
      <div className="child-profile-card-header">
        <div>
          <p className="listing-meta">Age-band profile</p>
          <h2>{childProfile.label}</h2>
          <p className="form-note">{formatAgeBand(childProfile.ageBand)}</p>
        </div>
        <Badge tone={childProfile.isActive ? "success" : "warning"}>
          {childProfile.isActive ? "Active" : "Paused"}
        </Badge>
      </div>

      <div className="child-profile-privacy-note">
        <strong>{childProfile.isActive ? "Included in recommendations" : "Paused from planning"}</strong>
        <span>
          {childProfile.isActive
            ? "This profile can receive age-band category suggestions."
            : "Resume when this stage should be included in family planning again."}
        </span>
      </div>

      <div className="child-profile-card-actions">
        <Button type="button" variant="secondary" onClick={onToggleActive}>
          {childProfile.isActive ? "Pause recommendations" : "Resume recommendations"}
        </Button>
        <Link href={buildAssistantHref(
          "age_needs",
          `Help me plan BabyLoop marketplace needs for the ${formatAgeBand(childProfile.ageBand)} stage.`
        )}>
          Ask Assistant
        </Link>
        <Button type="button" variant="secondary" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  );
}

function LifecycleRecommendationGroupCard({ group }: { group: LifecycleRecommendationGroup }) {
  return (
    <Card as="article" className="lifecycle-group-card">
      <div className="child-profile-card-header">
        <div>
          <p className="eyebrow">{formatAgeBand(group.ageBand)}</p>
          <h3>{buildParentMilestoneTitle(group)}</h3>
          <p className="form-note">{buildParentMilestoneDescription()}</p>
        </div>
        <Badge>{group.recommendations.length} needs</Badge>
      </div>

      <div className="lifecycle-needs-list">
        {group.recommendations.map((recommendation) => (
          <LifecycleNeedCard
            ageBand={group.ageBand}
            key={`${group.childProfileId}-${recommendation.categoryId}`}
            recommendation={recommendation}
          />
        ))}
      </div>

      <div className="child-profile-safety-note">
        This is a marketplace needs guide, not medical, nutrition, sleep-training, or therapy advice.
        For child-specific health or development decisions, consult a qualified professional.
      </div>
    </Card>
  );
}

function LifecycleNeedCard({
  ageBand,
  recommendation
}: {
  ageBand: ChildAgeBand;
  recommendation: LifecycleRecommendation;
}) {
  return (
    <div className="lifecycle-need-card">
      <div>
        <strong>{recommendation.categoryName}</strong>
        <p>{recommendation.whyNow}</p>
        <p className="form-note">{recommendation.reasonLabel}</p>
        <p className="ai-debug">
          {recommendation.reasoningProviderName} · {recommendation.reasoningPromptVersion} · confidence{" "}
          {formatConfidence(recommendation.reasoningConfidenceScore)}
        </p>
      </div>

      <div className="lifecycle-need-actions">
        <Link href={`/categories/${recommendation.categorySlug}`}>Browse category</Link>
        <Link href={buildLifecycleBrowseHref(recommendation)}>Search need</Link>
        <Link href={`/account/saved-searches`}>Saved searches</Link>
        <Link
          href={buildAssistantHref(
            "age_needs",
            `Help me plan ${recommendation.categoryName} for the ${formatAgeBand(ageBand)} stage. Keep it to marketplace planning, not medical advice.`
          )}
        >
          Ask Assistant
        </Link>
      </div>
    </div>
  );
}

function ParentGuideTopicsSection({
  topics
}: {
  topics: ReturnType<typeof getGuideTopicsForProfiles>;
}) {
  return (
    <section className="child-profile-workspace" aria-label="Parent guide topics">
      <div className="section-heading">
        <h2>Parents also ask</h2>
        <p className="muted">
          Curated topics that can later support BabyLoop Assistant and RAG answers.
        </p>
      </div>

      <div className="parent-guide-grid child-profile-guide-grid">
        {topics.slice(0, 4).map((topic) => (
          <Card as="article" className="parent-guide-card child-profile-guide-card" key={topic.id}>
            <p className="eyebrow">{topic.eyebrow}</p>
            <h3>{topic.title}</h3>
            <p>{topic.summary}</p>
            <div className="child-profile-safety-note">
              <strong>Common misconception:</strong> {topic.knownMyth}
            </div>
            <p className="form-note">
              <strong>AI note:</strong> {topic.aiNote}
            </p>
            <div className="child-profile-card-actions">
              <Link href={`/guides/${topic.id}`}>Read guide</Link>
              <Link href={topic.browseHref}>Find listings</Link>
              <Link
                href={buildAssistantHref(
                  "age_needs",
                  `Turn the ${topic.title} guide into a short BabyLoop marketplace checklist. Avoid medical advice.`
                )}
              >
                Ask Assistant
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function buildProfileMetrics(
  childProfiles: ChildProfile[],
  recommendationGroups: LifecycleRecommendationGroup[]
) {
  const activeProfiles = childProfiles.filter((childProfile) => childProfile.isActive).length;
  const ageBandCount = new Set(childProfiles.map((childProfile) => childProfile.ageBand)).size;
  const recommendationCount = recommendationGroups.reduce(
    (total, group) => total + group.recommendations.length,
    0
  );

  return {
    totalProfiles: childProfiles.length,
    activeProfiles,
    pausedProfiles: childProfiles.length - activeProfiles,
    ageBandCount,
    recommendationCount
  };
}

function getGuideTopicsForProfiles(childProfiles: ChildProfile[], selectedAgeBand: ChildAgeBand) {
  const activeAgeBands = childProfiles
    .filter((childProfile) => childProfile.isActive)
    .map((childProfile) => childProfile.ageBand);
  const ageBands = activeAgeBands.length > 0 ? activeAgeBands : [selectedAgeBand];

  return dedupeGuideTopics(ageBands.flatMap((currentAgeBand) => getGuideTopicsForAgeBand(currentAgeBand)));
}

function dedupeGuideTopics<T extends { id: string }>(topics: T[]): T[] {
  const seen = new Set<string>();

  return topics.filter((topic) => {
    if (seen.has(topic.id)) {
      return false;
    }

    seen.add(topic.id);
    return true;
  });
}

function buildLifecycleBrowseHref(recommendation: LifecycleRecommendation): string {
  const params = new URLSearchParams({
    categoryId: recommendation.categoryId,
    q: recommendation.categoryName,
    sort: "newest"
  });

  return `/browse?${params.toString()}`;
}

function formatAgeBand(ageBand: ChildAgeBand): string {
  return AGE_BAND_OPTIONS.find((option) => option.value === ageBand)?.label ?? ageBand;
}

function buildParentMilestoneTitle(group: LifecycleRecommendationGroup): string {
  return `${group.childProfileLabel} is in the ${formatAgeBand(group.ageBand)} stage`;
}

function buildParentMilestoneDescription(): string {
  return "A lightweight list of marketplace categories that may become useful around this stage.";
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

type AssistantEntryMode = "age_needs" | "find_products" | "sell_help" | "safe_buying" | "platform_help";

function buildAssistantHref(mode: AssistantEntryMode, prompt: string): string {
  const params = new URLSearchParams({
    mode,
    prompt
  });

  return `/assistant?${params.toString()}`;
}
