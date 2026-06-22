import { randomUUID } from "node:crypto";
import type {
  RagEvalRunMode,
  RagEvalRunResult,
  RagEvalRunSummary
} from "./rag-eval-runner.service.js";

export type RagEvalHistoryStatus = "completed" | "failed";

export type RagEvalHistoryEntry = {
  runId: string;
  mode: RagEvalRunMode;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  status: RagEvalHistoryStatus;
  results: RagEvalRunResult[];
};

export type RagEvalHistoryListItem = Omit<RagEvalHistoryEntry, "results">;

export class RagEvalHistoryService {
  private readonly entries: RagEvalHistoryEntry[] = [];
  private readonly maxRuns: number;

  constructor(options: { maxRuns: number }) {
    this.maxRuns = Math.max(1, options.maxRuns);
  }

  record(summary: RagEvalRunSummary, status: RagEvalHistoryStatus = "completed"): RagEvalHistoryEntry {
    const finishedAt = new Date();
    const startedAt = new Date(Math.max(0, finishedAt.getTime() - summary.durationMs));
    const entry: RagEvalHistoryEntry = {
      runId: randomUUID(),
      mode: summary.mode,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: summary.durationMs,
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      status,
      results: summary.results
    };

    this.entries.unshift(entry);

    if (this.entries.length > this.maxRuns) {
      this.entries.splice(this.maxRuns);
    }

    return entry;
  }

  list(): RagEvalHistoryListItem[] {
    return this.entries.map((entry) => ({
      runId: entry.runId,
      mode: entry.mode,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      durationMs: entry.durationMs,
      total: entry.total,
      passed: entry.passed,
      failed: entry.failed,
      status: entry.status
    }));
  }

  get(runId: string): RagEvalHistoryEntry | null {
    return this.entries.find((entry) => entry.runId === runId) ?? null;
  }
}
