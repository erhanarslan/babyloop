import type { RagAssistantService } from "./rag-assistant.service.js";
import {
  ragEvalCases,
  type RagEvalCase,
  type RagEvalExpectedMode
} from "./rag-eval-cases.js";
import type { RagCitation } from "./rag.types.js";

export type RagEvalRunMode = "mock" | "live";

export type RagEvalIssue =
  | "mode_mismatch"
  | "missing_required_source_topic"
  | "forbidden_phrase_found"
  | "no_sources"
  | "low_score"
  | "unexpected_error"
  | "live_eval_disabled";

export type RagEvalRunResult = {
  id: string;
  query: string;
  expectedMode: RagEvalExpectedMode;
  actualMode: RagEvalExpectedMode;
  passed: boolean;
  score: number;
  sources: RagCitation[];
  issues: RagEvalIssue[];
};

export type RagEvalRunSummary = {
  mode: RagEvalRunMode;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: RagEvalRunResult[];
};

export type RagEvalRunnerOptions = {
  assistantService?: RagAssistantService | null;
  cases?: RagEvalCase[];
  liveEvalEnabled: boolean;
};

export class RagEvalRunner {
  private readonly assistantService: RagAssistantService | null;
  private readonly cases: RagEvalCase[];
  private readonly liveEvalEnabled: boolean;

  constructor(options: RagEvalRunnerOptions) {
    this.assistantService = options.assistantService ?? null;
    this.cases = options.cases ?? ragEvalCases;
    this.liveEvalEnabled = options.liveEvalEnabled;
  }

  async run(options: { limit?: number; mode?: RagEvalRunMode }): Promise<RagEvalRunSummary> {
    const startedAt = Date.now();
    const mode = options.mode ?? "mock";
    const limit = Math.min(Math.max(options.limit ?? this.cases.length, 1), 50);
    const selectedCases = this.cases.slice(0, limit);

    if (mode === "live" && !this.liveEvalEnabled) {
      const results = selectedCases.map((testCase) => buildFailedResult(testCase, ["live_eval_disabled"]));

      return summarize(mode, startedAt, results);
    }

    const results: RagEvalRunResult[] = [];

    for (const testCase of selectedCases) {
      results.push(mode === "live"
        ? await this.runLiveCase(testCase)
        : this.runMockCase(testCase));
    }

    return summarize(mode, startedAt, results);
  }

  private runMockCase(testCase: RagEvalCase): RagEvalRunResult {
    const actualMode = testCase.expectedMode;
    const sources = actualMode === "rag"
      ? buildMockSources(testCase.requiredSourceTopics)
      : [];

    return evaluateCase(testCase, {
      actualMode,
      answer: "BabyLoop bilgi tabanına göre kısa ve güvenli bir yanıt.",
      score: actualMode === "rag" ? 0.9 : 1,
      sources
    });
  }

  private async runLiveCase(testCase: RagEvalCase): Promise<RagEvalRunResult> {
    if (!this.assistantService) {
      return buildFailedResult(testCase, ["unexpected_error"]);
    }

    try {
      const answer = await this.assistantService.answerMessage({
        message: testCase.query,
        locale: "tr"
      });

      return evaluateCase(testCase, {
        actualMode: answer.mode === "boundary" ? "boundary" : answer.mode === "rag" ? "rag" : "no_source",
        answer: answer.answer,
        score: answer.grounded ? 0.85 : 0.5,
        sources: answer.sources
      });
    } catch {
      return buildFailedResult(testCase, ["unexpected_error"]);
    }
  }
}

function evaluateCase(
  testCase: RagEvalCase,
  actual: { actualMode: RagEvalExpectedMode; answer: string; score: number; sources: RagCitation[] }
): RagEvalRunResult {
  const issues: RagEvalIssue[] = [];

  if (testCase.expectedMode !== actual.actualMode) {
    issues.push("mode_mismatch");
  }

  if (testCase.expectedMode === "rag" && actual.sources.length === 0) {
    issues.push("no_sources");
  }

  if (testCase.requiredSourceTopics.length > 0) {
    const sourceTopics = new Set(actual.sources.map((source) => source.topic).filter(Boolean));
    const hasRequiredTopic = testCase.requiredSourceTopics.some((topic) => sourceTopics.has(topic));

    if (!hasRequiredTopic) {
      issues.push("missing_required_source_topic");
    }
  }

  if (testCase.forbiddenPhrases.some((phrase) => actual.answer.toLocaleLowerCase("tr").includes(phrase.toLocaleLowerCase("tr")))) {
    issues.push("forbidden_phrase_found");
  }

  if (actual.actualMode === "rag" && actual.score < 0.72) {
    issues.push("low_score");
  }

  return {
    id: testCase.id,
    query: testCase.query,
    expectedMode: testCase.expectedMode,
    actualMode: actual.actualMode,
    passed: issues.length === 0,
    score: actual.score,
    sources: actual.sources,
    issues
  };
}

function buildMockSources(requiredTopics: string[]): RagCitation[] {
  const topics = requiredTopics.length > 0 ? requiredTopics.slice(0, 2) : ["safe-shopping"];

  return topics.map((topic) => ({
    title: "Mock RAG kaynağı",
    sourcePath: `docs/rag/mock-${topic}.md`,
    section: "Mock bölüm",
    topic
  }));
}

function buildFailedResult(testCase: RagEvalCase, issues: RagEvalIssue[]): RagEvalRunResult {
  return {
    id: testCase.id,
    query: testCase.query,
    expectedMode: testCase.expectedMode,
    actualMode: "no_source",
    passed: false,
    score: 0,
    sources: [],
    issues
  };
}

function summarize(mode: RagEvalRunMode, startedAt: number, results: RagEvalRunResult[]): RagEvalRunSummary {
  const passed = results.filter((result) => result.passed).length;

  return {
    mode,
    total: results.length,
    passed,
    failed: results.length - passed,
    durationMs: Date.now() - startedAt,
    results
  };
}
