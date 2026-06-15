"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, PageContainer, PageHeading } from "../../components/ui";
import {
  parentGuideTopics,
  type ParentGuideAgeBand,
  type ParentGuideTopic
} from "./parent-guide-data";

type GuideFilter = "all" | "safety" | ParentGuideAgeBand;

const guideFilters: Array<{ label: string; value: GuideFilter }> = [
  { label: "All", value: "all" },
  { label: "Expecting", value: "expecting" },
  { label: "0-12 months", value: "infant_6_12" },
  { label: "Toddler", value: "toddler_12_24" },
  { label: "Preschool", value: "preschool_24_36" },
  { label: "Safety", value: "safety" }
];

const educationSteps = [
  {
    title: "Understand",
    body: "Start with the parent question, the age band, and the category context before browsing."
  },
  {
    title: "Check",
    body: "Turn the guide into condition, missing-parts, photo, hygiene, and pickup questions."
  },
  {
    title: "Act",
    body: "Open related listings, create saved searches, or ask the assistant for a short marketplace checklist."
  }
];

export function ParentGuidesPageContent() {
  const [activeFilter, setActiveFilter] = useState<GuideFilter>("all");
  const filteredTopics = useMemo(
    () => parentGuideTopics.filter((topic) => matchesGuideFilter(topic, activeFilter)),
    [activeFilter]
  );
  const metrics = useMemo(() => buildGuideMetrics(parentGuideTopics), []);

  return (
    <>
      <PageHeading
        eyebrow="Parent guides"
        title="Stage-based buying guides"
        description="Curated BabyLoop guides for age-band needs, second-hand safety, common parent questions, and practical marketplace planning."
      />

      <PageContainer className="parent-guides-education-layout listing-column" ariaLabel="Parent guides">
        <Card as="section" className="parent-guides-education-hero">
          <div>
            <p className="eyebrow">Product education layer</p>
            <h2>Controlled guides before open-ended AI answers.</h2>
            <p>
              BabyLoop guides connect age-band planning, category discovery, saved searches,
              listing questions, and assistant prompts without giving medical, nutrition, therapy, or diagnosis advice.
            </p>
            <div className="parent-guide-hero-actions">
              <Link href="/account/children">Add child profile</Link>
              <Link href="/browse">Browse marketplace</Link>
              <Link
                href={buildAssistantHref(
                  "age_needs",
                  "Help me turn BabyLoop parent guides into a stage-based marketplace needs plan."
                )}
              >
                Ask Assistant
              </Link>
            </div>
          </div>

          <aside className="parent-guide-hero-principles" aria-label="Parent guide principles">
            <div>
              <span>Indexed</span>
              <strong>Public SEO guides</strong>
            </div>
            <div>
              <span>Grounded</span>
              <strong>Curated topics and checklists</strong>
            </div>
            <div>
              <span>Boundary</span>
              <strong>Marketplace guidance only</strong>
            </div>
          </aside>
        </Card>

        <section className="parent-guide-education-grid" aria-label="Guide workflow">
          {educationSteps.map((step, index) => (
            <Card as="article" className="parent-guide-education-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </Card>
          ))}
        </section>

        <Card as="section" className="parent-guide-overview" aria-label="Guide summary">
          <div>
            <p className="eyebrow">Guide library</p>
            <h2>Use guides as the bridge between browsing and deciding</h2>
            <p>
              These topics are intentionally small and controlled. They can power SEO pages today,
              assistant grounding tomorrow, and safer marketplace actions throughout the buyer journey.
            </p>
          </div>

          <div className="parent-guide-metrics">
            <MetricCard label="Guides" value={metrics.guides} />
            <MetricCard label="Age bands" value={metrics.ageBands} />
            <MetricCard label="Categories" value={metrics.categories} />
            <MetricCard label="Questions" value={metrics.questions} />
          </div>
        </Card>

        <div className="parent-guide-filter-tabs" aria-label="Filter parent guides">
          {guideFilters.map((filter) => (
            <button
              aria-pressed={activeFilter === filter.value}
              className={activeFilter === filter.value ? "active" : ""}
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
              <span>{parentGuideTopics.filter((topic) => matchesGuideFilter(topic, filter.value)).length}</span>
            </button>
          ))}
        </div>

        <section className="parent-guide-grid parent-guide-education-card-grid" aria-label="Guide topics">
          {filteredTopics.map((topic) => (
            <GuideEducationCard key={topic.id} topic={topic} />
          ))}
        </section>

        <Card as="section" className="parent-guide-safety-boundary">
          <p className="eyebrow">Safety boundary</p>
          <h2>Marketplace guidance, not medical advice</h2>
          <p>
            These guides are for product discovery, second-hand buying checks, and parent planning. BabyLoop does not
            provide diagnosis, treatment, diet, therapy, or child-specific medical advice.
          </p>
        </Card>
      </PageContainer>
    </>
  );
}

function GuideEducationCard({ topic }: { topic: ParentGuideTopic }) {
  const checklist = buildDecisionChecklist(topic);

  return (
    <Card as="article" className="parent-guide-card parent-guide-education-topic-card">
      <div className="parent-guide-card-header">
        <div>
          <p className="eyebrow">{topic.eyebrow}</p>
          <h2>{topic.title}</h2>
        </div>
        <Badge>{topic.stageLabel}</Badge>
      </div>

      <p>{topic.summary}</p>

      <div className="parent-guide-topic-meta" aria-label={`${topic.title} coverage`}>
        <span>{topic.ageBands.length} age bands</span>
        <span>{topic.categorySlugs.length} categories</span>
        <span>{topic.commonQuestions.length} questions</span>
      </div>

      <div>
        <strong>Decision checklist</strong>
        <ul className="question-list">
          {checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="state-panel warning">
        <strong>Common misconception:</strong> {topic.knownMyth}
      </div>

      <p className="form-note">
        <strong>AI note:</strong> {topic.aiNote}
      </p>

      <CategorySlugStrip topic={topic} />

      <div className="home-personalization-actions parent-guide-actions">
        <Link href={`/guides/${topic.id}`}>Read guide</Link>
        <Link href={topic.browseHref}>Find related listings</Link>
        <Link href="/account/saved-searches">Saved searches</Link>
        <Link
          href={buildAssistantHref(
            "age_needs",
            `Turn the ${topic.title} guide into a short age-band marketplace checklist. Avoid medical advice.`
          )}
        >
          Ask Assistant
        </Link>
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="parent-guide-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CategorySlugStrip({ topic }: { topic: ParentGuideTopic }) {
  return (
    <div className="parent-guide-category-strip" aria-label="Related categories">
      {topic.categorySlugs.map((categorySlug) => (
        <Link href={`/categories/${categorySlug}`} key={categorySlug}>
          {formatCategorySlug(categorySlug)}
        </Link>
      ))}
    </div>
  );
}

function buildGuideMetrics(topics: ParentGuideTopic[]) {
  return {
    guides: topics.length,
    ageBands: new Set(topics.flatMap((topic) => topic.ageBands)).size,
    categories: new Set(topics.flatMap((topic) => topic.categorySlugs)).size,
    questions: topics.reduce((total, topic) => total + topic.commonQuestions.length, 0)
  };
}

function buildDecisionChecklist(topic: ParentGuideTopic): string[] {
  return [
    topic.commonQuestions[0] ?? "Clarify the parent need before browsing.",
    "Check condition, missing parts, hygiene, photos, and pickup expectations.",
    `Compare related categories: ${topic.categorySlugs.map(formatCategorySlug).join(", ")}.`
  ];
}

function matchesGuideFilter(topic: ParentGuideTopic, filter: GuideFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "safety") {
    return topic.id === "baby-gear-safety" || topic.categorySlugs.includes("car-seats");
  }

  return topic.ageBands.includes(filter);
}

function formatCategorySlug(categorySlug: string): string {
  return categorySlug
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type AssistantEntryMode = "age_needs" | "find_products" | "sell_help" | "safe_buying" | "platform_help";

function buildAssistantHref(mode: AssistantEntryMode, prompt: string): string {
  const params = new URLSearchParams({
    mode,
    prompt
  });

  return `/assistant?${params.toString()}`;
}
