"use client";

import { Button } from "../../components/ui";
import type { PriceSuggestion } from "./api";

type AiPriceSuggestionPanelProps = {
  suggestion: PriceSuggestion;
  onApplyPrice: () => void;
};

export function AiPriceSuggestionPanel({
  suggestion,
  onApplyPrice
}: AiPriceSuggestionPanelProps) {
  return (
    <section className="ai-suggestion-panel" aria-label="AI price suggestion">
      <div className="form-actions">
        <div>
          <p className="eyebrow">AI price suggestion</p>
          {suggestion.pricingMode === "suggested" ? (
            <h2>
              {suggestion.recommendedPriceAmount} {suggestion.currency}
            </h2>
          ) : (
            <h2>Price not required</h2>
          )}
          {suggestion.recommendedPriceMin && suggestion.recommendedPriceMax ? (
            <p>
              Suggested range: {suggestion.recommendedPriceMin}-{suggestion.recommendedPriceMax}{" "}
              {suggestion.currency}
            </p>
          ) : null}
        </div>

        {suggestion.recommendedPriceAmount ? (
          <Button type="button" variant="secondary" onClick={onApplyPrice}>
            Apply price
          </Button>
        ) : null}
      </div>

      <ul>
        {suggestion.rationale.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p className="muted">
        {suggestion.providerName} · {suggestion.promptVersion} · confidence{" "}
        {suggestion.confidenceScore}
      </p>
    </section>
  );
}
