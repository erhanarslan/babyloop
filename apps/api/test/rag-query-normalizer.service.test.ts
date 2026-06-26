import { describe, expect, it } from "vitest";
import {
  buildRetrievalQuery,
  extractAgeSignals,
  extractIntentTopicHints,
  extractLocationSignals,
  extractProductTerms,
  normalizeTurkishQuery,
  tokenizeRetrievalQuery
} from "../src/services/rag-query-normalizer.service.js";

describe("rag query normalizer", () => {
  it("normalizes Turkish typo variants without losing Turkish characters", () => {
    expect(normalizeTurkishQuery("  Bebek arabasi alirken nelere bakmaliyim? ")).toContain("bebek arabası");
    expect(normalizeTurkishQuery("oto koltugu ikinci el")).toContain("oto koltuğu");
    expect(normalizeTurkishQuery("ana kucagi")).toBe("ana kucağı");
  });

  it("extracts product terms, age signals, location signals and topic hints", () => {
    const query = "İstanbul'da 18 aylık çocuk için ikinci el oto koltugu var mı?";

    expect(extractProductTerms(query)).toContain("oto koltuğu");
    expect(extractAgeSignals(query)).toContain("18 ay");
    expect(extractLocationSignals(query)).toContain("istanbul");
    expect(extractIntentTopicHints(query)).toEqual(expect.arrayContaining(["car-seat-safety", "second-hand-risk", "age-based-needs"]));
  });

  it("builds a retrieval query with canonical signals", () => {
    const analysis = buildRetrievalQuery("kışın 2 yaş çocuk için ne lazım");

    expect(analysis.normalizedQuery).toBe("kışın 2 yaş çocuk için ne lazım");
    expect(analysis.ageSignals).toContain("2 yaş");
    expect(analysis.topicHints).toEqual(expect.arrayContaining(["seasonal-needs", "age-based-needs"]));
    expect(analysis.retrievalQuery).toContain("seasonal-needs");
  });

  it("tokenizes without common stop words", () => {
    expect(tokenizeRetrievalQuery("Bebek arabası için ne lazım?")).toEqual(expect.arrayContaining(["bebek", "arabası"]));
    expect(tokenizeRetrievalQuery("Bebek arabası için ne lazım?")).not.toContain("için");
  });

  it("extracts everyday care and pregnancy topic hints", () => {
    expect(extractIntentTopicHints("Çocuğum ishal oldu ne yapayım?")).toContain("diarrhea-vomiting-care");
    expect(extractIntentTopicHints("Ateşi var ne yapayım?")).toContain("fever-care");
    expect(extractIntentTopicHints("Çocuk sahibi olmak istiyorum şansımı nasıl artırırım?")).toContain("preconception-pregnancy");
    expect(buildRetrievalQuery("Hamilelikte doğum çantası ne zaman hazırlanır?").topicHints).toEqual(expect.arrayContaining(["pregnancy-preparation"]));
  });

});
