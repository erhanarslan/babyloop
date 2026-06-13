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
    <section className="ai-suggestion-panel" aria-label={dictionary.listings.aiSuggestionLabel}>
      <div>
        <h2>{dictionary.listings.aiSuggestionTitle}</h2>
        <p className="ai-suggestion-title">{suggestion.suggestedTitle}</p>
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

      <div className="tag-list" aria-label={dictionary.listings.suggestedTagsLabel}>
        {suggestion.suggestedTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      {suggestion.safetyWarnings.length > 0 ? (
        <div>
          <h3>Safety checks</h3>
          <ul className="question-list">
            {suggestion.safetyWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {suggestion.missingInfoQuestions.length > 0 ? (
        <div>
          <h3>Missing details</h3>
          <ul className="question-list">
            {suggestion.missingInfoQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="form-button-row">
        <Button type="button" variant="secondary" onClick={onApplySuggestion}>
          Apply suggestion
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
