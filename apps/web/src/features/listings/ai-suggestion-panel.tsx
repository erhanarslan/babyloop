"use client";

import { useI18n } from "../../lib/i18n/i18n-provider";
import type { ListingSuggestion } from "./api";

type AiSuggestionPanelProps = {
  suggestion: ListingSuggestion;
};

export function AiSuggestionPanel({ suggestion }: AiSuggestionPanelProps) {
  const { dictionary } = useI18n();

  return (
    <section className="ai-suggestion-panel" aria-label={dictionary.listings.aiSuggestionLabel}>
      <div>
        <h2>{dictionary.listings.aiSuggestionTitle}</h2>
        <p>{suggestion.suggestedDescription}</p>
      </div>

      <div className="tag-list" aria-label={dictionary.listings.suggestedTagsLabel}>
        {suggestion.suggestedTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      {suggestion.missingInfoQuestions.length > 0 ? (
        <ul className="question-list">
          {suggestion.missingInfoQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      ) : null}

      <p className="ai-debug">
        {suggestion.providerName} · {suggestion.promptVersion} · {dictionary.listings.confidence}{" "}
        {suggestion.confidenceScore}
      </p>
    </section>
  );
}
