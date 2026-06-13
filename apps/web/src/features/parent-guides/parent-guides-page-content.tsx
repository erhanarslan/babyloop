"use client";

import Link from "next/link";
import { Badge, Card, PageContainer, PageHeading } from "../../components/ui";
import { parentGuideTopics } from "./parent-guide-data";

export function ParentGuidesPageContent() {
  return (
    <>
      <PageHeading
        eyebrow="Parent guides"
        title="Stage-based buying guides"
        description="Curated BabyLoop guides for age-band needs, second-hand safety, common parent questions, and practical marketplace planning."
      />

      <PageContainer className="listing-column" ariaLabel="Parent guides">
        <Card as="section" className="seller-insight-callout">
          <div>
            <p className="eyebrow">BabyLoop Assistant foundation</p>
            <h2>Guides first, chatbot later</h2>
            <p className="form-note">
              These controlled guide topics will later power the assistant and RAG layer. For now, they keep the web experience useful without opening community moderation risk.
            </p>
          </div>
          <div className="home-personalization-actions">
            <Link href="/account/children">Add child profile</Link>
            <Link href="/browse">Browse marketplace</Link>
          </div>
        </Card>

        <section className="parent-guide-grid" aria-label="Guide topics">
          {parentGuideTopics.map((topic) => (
            <Card as="article" className="parent-guide-card" key={topic.id}>
              <div className="form-actions">
                <div>
                  <p className="eyebrow">{topic.eyebrow}</p>
                  <h2>{topic.title}</h2>
                </div>
                <Badge>{topic.stageLabel}</Badge>
              </div>

              <p>{topic.summary}</p>

              <div>
                <strong>Parents often ask</strong>
                <ul className="question-list">
                  {topic.commonQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>

              <div className="state-panel warning">
                <strong>Common misconception:</strong> {topic.knownMyth}
              </div>

              <p className="form-note">
                <strong>AI note:</strong> {topic.aiNote}
              </p>

              <div className="home-personalization-actions">
                <Link href={topic.browseHref}>Find related listings</Link>
              </div>
            </Card>
          ))}
        </section>

        <Card as="section" className="form-panel">
          <p className="eyebrow">Safety boundary</p>
          <h2>Marketplace guidance, not medical advice</h2>
          <p className="form-note">
            These guides are for product discovery, second-hand buying checks, and parent planning. BabyLoop does not provide diagnosis, treatment, diet, therapy, or child-specific medical advice.
          </p>
        </Card>
      </PageContainer>
    </>
  );
}
