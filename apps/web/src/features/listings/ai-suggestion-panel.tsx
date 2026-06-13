"use client";

import { Button } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import type { ListingSuggestion } from "./api";

type AiSuggestionPanelProps = {
  suggestion: ListingSuggestion;
  onApplySuggestion: () => void;
};

export function AiSuggestionPanel({ suggestion, onApplySuggestion }: AiSuggestionPanelProps) {
  const { dictionary } = useI18n();

  return (
    <section className="ai-suggestion-panel ai-workflow-panel" aria-label={dictionary.listings.aiSuggestionLabel}>
      <div className="ai-workflow-header">
        <div>
          <p className="eyebrow">AI listing assistant</p>
          <h2>{dictionary.listings.aiSuggestionTitle}</h2>
          <p className="form-note">
            Review the draft before applying it. BabyLoop never publishes AI content automatically.
          </p>
        </div>
        <span className="ai-confidence-pill">{formatConfidence(suggestion.confidenceScore)} confidence</span>
      </div>

      <div className="ai-suggestion-draft-card">
        <p className="eyebrow">Suggested title</p>
        <h3>{suggestion.suggestedTitle}</h3>
        <p>{suggestion.suggestedDescription}</p>
      </div>

      <div className="ai-suggestion-summary-grid">
        <div>
          <span className="eyebrow">Suggested category</span>
          <strong>{formatOptionalText(suggestion.suggestedCategoryName)}</strong>
        </div>
        <div>
          <span className="eyebrow">Suggested condition</span>
          <strong>{formatOptionalText(suggestion.suggestedCondition)}</strong>
        </div>
        <div>
          <span className="eyebrow">Suggested listing type</span>
          <strong>{suggestion.suggestedListingType}</strong>
        </div>
      </div>

      {suggestion.suggestedTags.length > 0 ? (
        <div>
          <p className="eyebrow">Suggested tags</p>
          <div className="tag-list" aria-label={dictionary.listings.suggestedTagsLabel}>
            {suggestion.suggestedTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ai-guidance-grid">
        <div className="ai-guidance-card">
          <h3>Safety checks</h3>
          {suggestion.safetyWarnings.length > 0 ? (
            <ul className="question-list">
              {suggestion.safetyWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="form-note">No major safety warnings were returned. Still review the listing manually.</p>
          )}
        </div>

        <div className="ai-guidance-card">
          <h3>Missing details</h3>
          {suggestion.missingInfoQuestions.length > 0 ? (
            <ul className="question-list">
              {suggestion.missingInfoQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          ) : (
            <p className="form-note">The draft looks complete enough to continue.</p>
          )}
        </div>
      </div>

      <div className="state-panel warning">
        AI can help with wording and structure, but you are responsible for accurate condition, price, photos, and included parts.
      </div>

      <div className="form-button-row">
        <Button type="button" variant="secondary" onClick={onApplySuggestion}>
          Apply AI draft to form
        </Button>
      </div>

      <p className="ai-debug">
        {suggestion.providerName} · {suggestion.promptVersion} · {dictionary.listings.confidence}{" "}
        {suggestion.confidenceScore}
      </p>
    </section>
  );
}

function formatOptionalText(value: string | null): string {
  return value?.trim() ? value : "Not suggested";
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}
