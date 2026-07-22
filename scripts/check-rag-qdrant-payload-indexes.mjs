import { readFileSync } from "node:fs";

const files = {
  build: "apps/api/src/scripts/rag-index-build.ts",
  deployment: "apps/api/src/services/rag-index-deployment.service.ts",
  ingest: "apps/api/src/scripts/rag-ingest.ts",
  store: "apps/api/src/services/rag-qdrant-vector-store.service.ts",
  test: "apps/api/test/rag-qdrant-payload-indexes.service.test.ts"
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [
    key,
    readFileSync(file, "utf8")
  ])
);

const failures = [];

function mustContain(key, token) {
  if (!source[key].includes(token)) {
    failures.push(`${files[key]} missing ${token}`);
  }
}

for (const field of ["answerOwner", "topic", "sourcePath"]) {
  mustContain("store", `"${field}"`);
}

mustContain("store", "RAG_QDRANT_FILTER_PAYLOAD_INDEXES");
mustContain("store", "ensureSearchPayloadIndexes");
mustContain("store", 'field_schema: "keyword"');
mustContain("store", "/index?wait=true");
mustContain("build", "ensureSearchPayloadIndexes(targetCollection)");
mustContain("ingest", "ensureSearchPayloadIndexes()");
mustContain("deployment", "keyword payload index");
mustContain("test", "fails candidate validation when a required keyword index is missing");

if (failures.length > 0) {
  console.error("RAG Qdrant payload index guard failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("RAG Qdrant payload index guard passed.");
