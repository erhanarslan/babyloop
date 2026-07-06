"use client";

import Link from "next/link";
import { ProtectedActionLink } from "../auth/protected-action-link";
import { Badge, Card } from "../../components/ui";
import { parentGuideTopics } from "./parent-guide-data";

export function ParentGuidePreviewSection() {
  const previewTopics = parentGuideTopics.slice(0, 3);

  return (
    <section className="home-section parent-guide-preview-section parent-guide-preview-section-polished">
      <div className="home-section-heading">
        <p className="eyebrow">Parent education</p>
        <h2>What parents ask before buying</h2>
        <p>
          Curated BabyLoop topics turn common parent questions, stage-based needs, and second-hand safety checks into practical marketplace actions.
        </p>
      </div>

      <div className="parent-guide-preview-strip">
        <span>Age-band planning</span>
        <span>Second-hand checks</span>
        <span>Assistant grounding</span>
        <span>Saved-search ideas</span>
      </div>

      <div className="home-card-grid">
        {previewTopics.map((topic) => (
          <Card as="article" className="home-feature-card parent-guide-preview-card parent-guide-preview-card-polished" key={topic.id}>
            <div className="parent-guide-card-header">
              <div>
                <p className="eyebrow">{topic.eyebrow}</p>
                <h3>{topic.title}</h3>
              </div>
              <Badge>{topic.stageLabel}</Badge>
            </div>
            <p>{topic.summary}</p>
            <p className="form-note">
              <strong>Common misconception:</strong> {topic.knownMyth}
            </p>
            <div className="home-personalization-actions">
              <Link href={`/guides/${topic.id}`}>Read guide</Link>
              <Link href={topic.browseHref}>Find listings</Link>
            </div>
          </Card>
        ))}
      </div>

      <div className="home-personalization-actions parent-guide-preview-actions">
        <Link href="/guides">Open all guides</Link>
        <Link href="/account/children">Get age-band suggestions</Link>
        <ProtectedActionLink authTitle="Asistana sormak için giriş yap" href="/assistant?mode=age_needs&prompt=Help%20me%20turn%20parent%20guides%20into%20a%20marketplace%20needs%20plan.">
          Ask Assistant
        </ProtectedActionLink>
      </div>
    </section>
  );
}
