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
    <section className="ai-suggestion-panel ai-workflow-panel" aria-label="AI price suggestion">
      <div className="ai-workflow-header">
        <div>
          <p className="eyebrow">AI price suggestion</p>
          {suggestion.pricingMode === "suggested" ? (
            <h2>
              {suggestion.recommendedPriceAmount} {suggestion.currency}
            </h2>
          ) : (
            <h2>Price not required</h2>
          )}
          <p className="form-note">
            Use this as a starting point. You can still edit the price before publishing.
          </p>
        </div>
        <span className="ai-confidence-pill">{formatConfidence(suggestion.confidenceScore)} confidence</span>
      </div>

      {suggestion.recommendedPriceMin && suggestion.recommendedPriceMax ? (
        <div className="ai-price-range">
          <span>Suggested range</span>
          <strong>
            {suggestion.recommendedPriceMin}-{suggestion.recommendedPriceMax} {suggestion.currency}
          </strong>
        </div>
      ) : null}

      <div className="ai-guidance-card">
        <h3>Pricing rationale</h3>
        <ul className="question-list">
          {suggestion.rationale.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="state-panel warning">
        Buyer demand, local pickup convenience, photo quality, and included accessories can change the final price.
      </div>

      {suggestion.recommendedPriceAmount ? (
        <div className="form-button-row">
          <Button type="button" variant="secondary" onClick={onApplyPrice}>
            Apply suggested price
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}
