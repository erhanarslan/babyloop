import { aiModelRuns } from "@babyloop/database/schema";
import { and, asc, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type {
  AdminAiOpsRunsQuery,
  AdminAiOpsRunSummaryResponse,
  AdminAiOpsSummaryResponse
} from "../schemas/admin-ai-ops.schemas.js";
import { createSafeTextPreview } from "./redaction.service.js";

const DEFAULT_AI_OPS_FEATURE = "moderation_summary";
const AI_RUN_STATUSES = [
  "success",
  "error",
  "validation_failed",
  "provider_failed",
  "skipped"
] as const;


export type AdminAiOpsRunSummary = AdminAiOpsRunSummaryResponse;
export type AdminAiOpsSummary = AdminAiOpsSummaryResponse;

type AiModelRunRow = {
  id: string;
  feature: string;
  providerName: string;
  modelName: string | null;
  promptVersion: string;
  input: Record<string, unknown>;
  confidenceScore: string | null;
  riskScore: string | null;
  status: (typeof AI_RUN_STATUSES)[number];
  errorMessage: string | null;
  createdAt: Date;
};

export async function getAdminAiOpsSummary(
  app: FastifyInstance
): Promise<AdminAiOpsSummaryResponse> {
  const now = new Date();
  const since24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalRuns,
    runsLast24Hours,
    runsLast7Days,
    successRunsLast7Days,
    failedRunsLast7Days,
    providerFailuresLast7Days,
    validationFailuresLast7Days,
    skippedRunsLast7Days,
    statusCounts,
    providerModelCounts,
    recentRuns
  ] = await Promise.all([
    countAiRuns(app),
    countAiRuns(app, gte(aiModelRuns.createdAt, since24Hours)),
    countAiRuns(app, gte(aiModelRuns.createdAt, since7Days)),
    countAiRuns(app, and(eq(aiModelRuns.status, "success"), gte(aiModelRuns.createdAt, since7Days))),
    countAiRuns(app, and(inFailureStatus(), gte(aiModelRuns.createdAt, since7Days))),
    countAiRuns(app, and(eq(aiModelRuns.status, "provider_failed"), gte(aiModelRuns.createdAt, since7Days))),
    countAiRuns(app, and(eq(aiModelRuns.status, "validation_failed"), gte(aiModelRuns.createdAt, since7Days))),
    countAiRuns(app, and(eq(aiModelRuns.status, "skipped"), gte(aiModelRuns.createdAt, since7Days))),
    countAiRunsByStatus(app),
    countAiRunsByProviderModel(app),
    listAdminAiOpsRuns(app, {
      feature: DEFAULT_AI_OPS_FEATURE,
      limit: 8,
      sort: "newest"
    })
  ]);

  return {
    totals: {
      totalRuns,
      runsLast24Hours,
      runsLast7Days,
      successRunsLast7Days,
      failedRunsLast7Days,
      providerFailuresLast7Days,
      validationFailuresLast7Days,
      skippedRunsLast7Days
    },
    statusCounts,
    providerModelCounts,
    recentRuns
  };
}

export async function listAdminAiOpsRuns(
  app: FastifyInstance,
  query: AdminAiOpsRunsQuery
): Promise<AdminAiOpsRunSummaryResponse[]> {
  const whereClauses: SQL[] = [];
  const normalizedFeature = query.feature?.trim() ?? DEFAULT_AI_OPS_FEATURE;
  const normalizedProvider = query.providerName?.trim() ?? "";
  const normalizedQuery = query.q?.trim() ?? "";

  whereClauses.push(eq(aiModelRuns.feature, normalizedFeature));

  if (query.status) {
    whereClauses.push(eq(aiModelRuns.status, query.status));
  }

  if (normalizedProvider) {
    whereClauses.push(eq(aiModelRuns.providerName, normalizedProvider));
  }

  if (normalizedQuery) {
    const pattern = `%${normalizedQuery}%`;

    whereClauses.push(
      or(
        sql`${aiModelRuns.id}::text ilike ${pattern}`,
        ilike(aiModelRuns.providerName, pattern),
        sql`${aiModelRuns.modelName} ilike ${pattern}`,
        ilike(aiModelRuns.promptVersion, pattern),
        sql`${aiModelRuns.input}->>'caseId' ilike ${pattern}`
      )!
    );
  }

  const rows = await app.db
    .select({
      id: aiModelRuns.id,
      feature: aiModelRuns.feature,
      providerName: aiModelRuns.providerName,
      modelName: aiModelRuns.modelName,
      promptVersion: aiModelRuns.promptVersion,
      input: aiModelRuns.input,
      confidenceScore: aiModelRuns.confidenceScore,
      riskScore: aiModelRuns.riskScore,
      status: aiModelRuns.status,
      errorMessage: aiModelRuns.errorMessage,
      createdAt: aiModelRuns.createdAt
    })
    .from(aiModelRuns)
    .where(and(...whereClauses))
    .orderBy(query.sort === "oldest" ? asc(aiModelRuns.createdAt) : desc(aiModelRuns.createdAt))
    .limit(query.limit ?? 50);

  return rows.map(mapAiModelRunRow);
}

async function countAiRuns(app: FastifyInstance, whereClause?: SQL): Promise<number> {
  const [row] = await app.db
    .select({
      itemCount: sql<number>`count(${aiModelRuns.id})::int`
    })
    .from(aiModelRuns)
    .where(whereClause);

  return row?.itemCount ?? 0;
}

async function countAiRunsByStatus(
  app: FastifyInstance
): Promise<Array<{ status: (typeof AI_RUN_STATUSES)[number]; count: number }>> {
  const rows = await app.db
    .select({
      status: aiModelRuns.status,
      itemCount: sql<number>`count(${aiModelRuns.id})::int`
    })
    .from(aiModelRuns)
    .groupBy(aiModelRuns.status)
    .orderBy(aiModelRuns.status);

  const counts = Object.fromEntries(AI_RUN_STATUSES.map((status) => [status, 0])) as Record<
    (typeof AI_RUN_STATUSES)[number],
    number
  >;

  for (const row of rows) {
    counts[row.status] = row.itemCount;
  }

  return AI_RUN_STATUSES.map((status) => ({ status, count: counts[status] }));
}

async function countAiRunsByProviderModel(
  app: FastifyInstance
): Promise<
  Array<{
    providerName: string;
    modelName: string | null;
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
  }>
> {
  const rows = await app.db
    .select({
      providerName: aiModelRuns.providerName,
      modelName: aiModelRuns.modelName,
      totalRuns: sql<number>`count(${aiModelRuns.id})::int`,
      successRuns: sql<number>`count(*) filter (where ${aiModelRuns.status} = 'success')::int`,
      failedRuns: sql<number>`count(*) filter (where ${aiModelRuns.status} in ('error', 'provider_failed', 'validation_failed'))::int`
    })
    .from(aiModelRuns)
    .groupBy(aiModelRuns.providerName, aiModelRuns.modelName)
    .orderBy(sql`count(${aiModelRuns.id}) desc`)
    .limit(12);

  return rows;
}

function inFailureStatus(): SQL {
  return sql`${aiModelRuns.status} in ('error', 'provider_failed', 'validation_failed')`;
}

function mapAiModelRunRow(row: AiModelRunRow): AdminAiOpsRunSummaryResponse {
  return {
    id: row.id,
    feature: row.feature,
    providerName: row.providerName,
    modelName: row.modelName,
    promptVersion: row.promptVersion,
    status: row.status,
    caseId: getCaseId(row.input),
    confidenceScore: parseOptionalNumber(row.confidenceScore),
    riskScore: parseOptionalNumber(row.riskScore),
    errorSummary: row.errorMessage ? createSafeTextPreview(row.errorMessage, 180) : null,
    createdAt: row.createdAt.toISOString()
  };
}

function getCaseId(input: Record<string, unknown>): string | null {
  return typeof input.caseId === "string" ? input.caseId : null;
}

function parseOptionalNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}
