"use client";

import Link from "next/link";
import { Badge, Card } from "../../components/ui";
import { parentGuideTopics } from "./parent-guide-data";

export function ParentGuidePreviewSection() {
  const previewTopics = parentGuideTopics.slice(0, 3);

  return (
    <section className="home-section parent-guide-preview-section">
      <div className="home-section-heading">
        <p className="eyebrow">Parent guide</p>
        <h2>What parents ask before buying</h2>
        <p>
          Curated BabyLoop topics turn common parent questions, stage-based needs, and second-hand safety checks into practical marketplace actions.
        </p>
      </div>

      <div className="home-card-grid">
        {previewTopics.map((topic) => (
          <Card as="article" className="home-feature-card parent-guide-preview-card" key={topic.id}>
            <div className="form-actions">
              <p className="eyebrow">{topic.eyebrow}</p>
              <Badge>{topic.stageLabel}</Badge>
            </div>
            <h3>{topic.title}</h3>
            <p>{topic.summary}</p>
            <p className="form-note">
              <strong>Common misconception:</strong> {topic.knownMyth}
            </p>
            <Link href="/guides">Read guide</Link>
          </Card>
        ))}
      </div>

      <div className="home-personalization-actions parent-guide-preview-actions">
        <Link href="/guides">Open all guides</Link>
        <Link href="/account/children">Get age-band suggestions</Link>
      </div>
    </section>
  );
}
