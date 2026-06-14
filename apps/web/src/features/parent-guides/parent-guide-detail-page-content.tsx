"use client";

import Link from "next/link";
import { Badge, Card, PageContainer, PageHeading } from "../../components/ui";
import type { ParentGuideTopic } from "./parent-guide-data";

type ParentGuideDetailPageContentProps = {
  topic: ParentGuideTopic;
};

export function ParentGuideDetailPageContent({ topic }: ParentGuideDetailPageContentProps) {
  return (
    <>
      <PageHeading
        eyebrow={topic.eyebrow}
        title={topic.title}
        description={topic.summary}
      />

      <PageContainer className="listing-column" ariaLabel={topic.title}>
        <Card as="section" className="parent-guide-detail-hero">
          <div>
            <p className="eyebrow">{topic.stageLabel}</p>
            <h2>Practical marketplace plan</h2>
            <p>
              Use this guide to turn a parent need into safer second-hand buying questions,
              category browsing, and saved-search ideas.
            </p>
          </div>
          <Badge>{topic.ageBands.length} age bands</Badge>
        </Card>

        <section className="parent-guide-detail-grid">
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
        </section>

        <Card as="section" className="parent-guide-card">
          <p className="eyebrow">Marketplace actions</p>
          <h2>Next step</h2>
          <p>
            Browse related listings, save a useful search, or ask BabyLoop Assistant to turn this guide into a short checklist.
          </p>
          <div className="home-personalization-actions">
            <Link href={topic.browseHref}>Find related listings</Link>
            <Link href="/account/saved-searches">Saved searches</Link>
            <Link
              href={buildAssistantHref(
                "age_needs",
                `Turn the ${topic.title} guide into a short BabyLoop checklist.`
              )}
            >
              Ask Assistant
            </Link>
          </div>
        </Card>

        <Card as="section" className="form-panel">
          <p className="eyebrow">Safety boundary</p>
          <h2>Marketplace guidance only</h2>
          <p className="form-note">
            This guide helps with product discovery, buying checks, and listing questions. It does not replace professional medical, nutrition, therapy, or safety advice.
          </p>
        </Card>
      </PageContainer>
    </>
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
