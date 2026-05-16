import type { ListingSuggestion } from "./api";

type AiSuggestionPanelProps = {
  suggestion: ListingSuggestion;
};

export function AiSuggestionPanel({ suggestion }: AiSuggestionPanelProps) {
  return (
    <section className="ai-suggestion-panel" aria-label="AI listing suggestion">
      <div>
        <h2>AI suggestion</h2>
        <p>{suggestion.suggestedDescription}</p>
      </div>

      <div className="tag-list" aria-label="Suggested tags">
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
        {suggestion.providerName} · {suggestion.promptVersion} · confidence{" "}
        {suggestion.confidenceScore}
      </p>
    </section>
  );
}

