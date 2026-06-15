"use client";

import Link from "next/link";
import { Badge, Card, PageContainer, PageHeading } from "../../components/ui";
import {
  parentGuideTopics,
  type ParentGuideTopic
} from "./parent-guide-data";

type ParentGuideDetailPageContentProps = {
  topic: ParentGuideTopic;
};

export function ParentGuideDetailPageContent({ topic }: ParentGuideDetailPageContentProps) {
  const relatedTopics = parentGuideTopics
    .filter((candidate) => candidate.id !== topic.id)
    .filter((candidate) =>
      candidate.ageBands.some((ageBand) => topic.ageBands.includes(ageBand)) ||
      candidate.categorySlugs.some((categorySlug) => topic.categorySlugs.includes(categorySlug))
    )
    .slice(0, 3);

  return (
    <>
      <PageHeading
        eyebrow={topic.eyebrow}
        title={topic.title}
        description={topic.summary}
      />

      <PageContainer className="parent-guide-detail-layout listing-column" ariaLabel={topic.title}>
        <Card as="section" className="parent-guide-detail-hero parent-guide-detail-hero-polished">
          <div>
            <p className="eyebrow">{topic.stageLabel}</p>
            <h2>Turn this guide into safer marketplace action.</h2>
            <p>
              Use this topic to clarify the parent need, inspect second-hand product context,
              browse related categories, save useful searches, and ask focused assistant prompts.
            </p>
            <div className="parent-guide-hero-actions">
              <Link href={topic.browseHref}>Find related listings</Link>
              <Link href="/account/saved-searches">Saved searches</Link>
              <Link
                href={buildAssistantHref(
                  "age_needs",
                  `Turn the ${topic.title} guide into a short BabyLoop marketplace checklist. Avoid medical advice.`
                )}
              >
                Ask Assistant
              </Link>
            </div>
          </div>

          <aside className="parent-guide-detail-facts" aria-label="Guide coverage">
            <div>
              <span>Age bands</span>
              <strong>{topic.ageBands.length}</strong>
            </div>
            <div>
              <span>Categories</span>
              <strong>{topic.categorySlugs.length}</strong>
            </div>
            <div>
              <span>Questions</span>
              <strong>{topic.commonQuestions.length}</strong>
            </div>
          </aside>
        </Card>

        <section className="parent-guide-detail-grid parent-guide-detail-grid-polished">
          <Card as="article" className="parent-guide-card">
            <p className="eyebrow">Decision checklist</p>
            <h2>Before you message or buy</h2>
            <ul className="question-list">
              {buildDecisionChecklist(topic).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>

          <Card as="article" className="parent-guide-card">
            <p className="eyebrow">Parents often ask</p>
            <h2>Questions to clarify</h2>
            <ul className="question-list">
              {topic.commonQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </Card>

          <Card as="article" className="parent-guide-card">
            <p className="eyebrow">Common misconception</p>
            <h2>What to avoid assuming</h2>
            <div className="state-panel warning">
              {topic.knownMyth}
            </div>
            <p className="form-note">
              <strong>Guidance:</strong> {topic.aiNote}
            </p>
          </Card>

          <Card as="article" className="parent-guide-card">
            <p className="eyebrow">Related categories</p>
            <h2>Browse with context</h2>
            <div className="parent-guide-category-strip">
              {topic.categorySlugs.map((categorySlug) => (
                <Link href={`/categories/${categorySlug}`} key={categorySlug}>
                  {formatCategorySlug(categorySlug)}
                </Link>
              ))}
            </div>
            <p className="form-note">
              Use category pages for SEO-friendly discovery, then narrow with browse filters and saved searches.
            </p>
          </Card>
        </section>

        <Card as="section" className="parent-guide-card parent-guide-action-panel">
          <div>
            <p className="eyebrow">Marketplace actions</p>
            <h2>Next step</h2>
            <p>
              Browse related listings, save a useful search, or ask BabyLoop Assistant to turn this guide into a short checklist.
            </p>
          </div>
          <div className="home-personalization-actions parent-guide-actions">
            <Link href={topic.browseHref}>Find related listings</Link>
            <Link href="/account/children">Use child profile</Link>
            <Link href="/account/saved-searches">Saved searches</Link>
            <Link
              href={buildAssistantHref(
                "safe_buying",
                `Prepare safe buyer questions for ${topic.title}. Keep it marketplace-only.`
              )}
            >
              Ask buying assistant
            </Link>
          </div>
        </Card>

        {relatedTopics.length > 0 ? (
          <section className="parent-guide-related-section" aria-label="Related parent guides">
            <div className="section-heading">
              <h2>Related guides</h2>
              <p className="muted">
                Continue with adjacent age bands or categories before creating a saved search.
              </p>
            </div>

            <div className="parent-guide-grid">
              {relatedTopics.map((relatedTopic) => (
                <Card as="article" className="parent-guide-card" key={relatedTopic.id}>
                  <div className="parent-guide-card-header">
                    <div>
                      <p className="eyebrow">{relatedTopic.eyebrow}</p>
                      <h3>{relatedTopic.title}</h3>
                    </div>
                    <Badge>{relatedTopic.stageLabel}</Badge>
                  </div>
                  <p>{relatedTopic.summary}</p>
                  <div className="home-personalization-actions">
                    <Link href={`/guides/${relatedTopic.id}`}>Read guide</Link>
                    <Link href={relatedTopic.browseHref}>Find listings</Link>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <Card as="section" className="parent-guide-safety-boundary">
          <p className="eyebrow">Safety boundary</p>
          <h2>Marketplace guidance only</h2>
          <p>
            This guide helps with product discovery, buying checks, and listing questions. It does not replace
            professional medical, nutrition, therapy, development, or safety advice.
          </p>
        </Card>
      </PageContainer>
    </>
  );
}

function buildDecisionChecklist(topic: ParentGuideTopic): string[] {
  return [
    "Clarify the product need, stage fit, and whether this item should be bought second-hand.",
    "Ask about condition, missing parts, original accessories, hygiene, usage history, and clear photos.",
    `Compare related categories: ${topic.categorySlugs.map(formatCategorySlug).join(", ")}.`
  ];
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
