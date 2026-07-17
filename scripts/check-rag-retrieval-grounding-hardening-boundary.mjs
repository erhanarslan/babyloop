import { existsSync, readFileSync } from "node:fs";

const problems = [];

function read(file) {
  if (!existsSync(file)) {
    problems.push(`Missing required file: ${file}`);
    return "";
  }

  return readFileSync(file, "utf8");
}

function mustContain(file, token) {
  const source = read(file);

  if (!source.includes(token)) {
    problems.push(`${file} must contain ${JSON.stringify(token)}`);
  }
}

function mustNotContain(file, token) {
  const source = read(file);

  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}`);
  }
}

const domainRouter = "apps/api/src/services/rag-domain-router.service.ts";
const ownerRegistry = "apps/api/src/services/rag-answer-owner-registry.ts";
const searchService = "apps/api/src/services/rag-search.service.ts";
const qdrantStore = "apps/api/src/services/rag-qdrant-vector-store.service.ts";
const validator = "apps/api/src/services/rag-answer-grounding-validator.service.ts";
const assistantService = "apps/api/src/services/rag-assistant.service.ts";
const evalCases = "apps/api/src/services/rag-eval-cases.ts";
const packageJson = "package.json";

mustContain(domainRouter, "feeding");
mustContain(domainRouter, "child_product_needs");
mustContain(domainRouter, "RAG_DOMAIN_ROUTER_VERSION");
mustContain(domainRouter, "FEEDING_PATTERNS");
mustContain(domainRouter, "AGE_CONTEXT_PATTERNS");
mustContain("apps/api/test/rag-domain-router.service.test.ts", "6 aylık erkek bebeğe ek gıda ne yedirilir?");
mustContain(ownerRegistry, "child_needs_recommendations");
mustContain(ownerRegistry, "feeding-and-food-safety-canon");
mustContain(ownerRegistry, "forbiddenTopics");
mustContain(ownerRegistry, "toolPolicy");
mustContain(searchService, "applyRagSearchPolicy");
mustContain(searchService, "forbidden_topic");
mustContain(searchService, "failsCanonicalOwnerCoverage");
mustContain(searchService, "policyFromAnswerOwner");
mustContain(qdrantStore, "answerOwner");
mustContain(qdrantStore, "toQdrantFilter");
mustContain(validator, "validateRagAnswerGrounding");
mustContain(validator, "forbidden_domain_vocabulary");
mustContain(assistantService, "groundingStatus");
mustContain(assistantService, "buildDeterministicCanonicalAnswer");
mustContain(assistantService, "noSourceAnswerForDomain");
mustContain(evalCases, "critical-feeding-six-month-boy");
mustContain(evalCases, "6 aylık erkek bebeğe ek gıda ne yedirilir?");
mustContain(evalCases, "critical-montessori-six-month");
mustContain(evalCases, "ragEvalCases.push(...buildGeneratedEvalCases())");

for (const file of [
  "apps/api/test/rag-domain-router.service.test.ts",
  "apps/api/test/rag-answer-owner-registry.test.ts",
  "apps/api/test/rag-answer-grounding-validator.service.test.ts",
  "apps/api/test/rag-search.service.test.ts",
  "apps/api/test/rag-assistant.service.test.ts",
  "apps/api/test/rag-eval-cases.test.ts"
]) {
  if (!existsSync(file)) {
    problems.push(`Missing RAG hardening test: ${file}`);
  }
}

mustContain("apps/api/test/rag-search.service.test.ts", "hard rejects high-vector cross-domain candidates");
mustContain("apps/api/test/rag-search.service.test.ts", "feeding canonical owner is missing");
mustContain("apps/api/test/rag-assistant.service.test.ts", "critical complementary feeding query");
mustContain("apps/api/test/assistant-tool-orchestrator.service.test.ts", "feeding domain would invoke child product tools");
mustContain("apps/api/test/rag-eval-cases.test.ts", "at least 150");
mustContain(packageJson, "security:rag-retrieval-grounding");
mustContain(packageJson, "test:rag:retrieval");
mustContain(packageJson, "test:rag:eval");
mustContain(packageJson, "release:rag");

for (const file of [
  domainRouter,
  ownerRegistry,
  searchService,
  qdrantStore,
  validator,
  assistantService
]) {
  mustNotContain(file, "embedding.join");
  mustNotContain(file, "console.log(embedding");
  mustNotContain(file, "process.env.GEMINI");
  mustNotContain(file, "process.env.OPENAI");
}

if (problems.length > 0) {
  console.error("RAG retrieval grounding hardening boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("RAG retrieval grounding hardening boundary passed.");
