const qdrantUrl = process.env.RAG_QDRANT_URL ?? process.env.QDRANT_URL ?? "";
const collectionName = process.env.RAG_QDRANT_COLLECTION ?? process.env.QDRANT_COLLECTION ?? "";

if (!qdrantUrl || !collectionName) {
  console.log("RAG Qdrant smoke skipped: RAG_QDRANT_URL/QDRANT_URL and collection name are not configured.");
  process.exit(0);
}

const endpoint = `${qdrantUrl.replace(/\/$/u, "")}/collections/${encodeURIComponent(collectionName)}`;
const response = await fetch(endpoint, {
  headers: {
    ...(process.env.RAG_QDRANT_API_KEY ? { "api-key": process.env.RAG_QDRANT_API_KEY } : {})
  }
});

if (!response.ok) {
  console.error(`RAG Qdrant smoke failed: collection info returned ${response.status}.`);
  process.exit(1);
}

const payload = await response.json();
const result = typeof payload.result === "object" && payload.result !== null ? payload.result : {};
const pointsCount = typeof result.points_count === "number" ? result.points_count : 0;

console.log(`RAG Qdrant smoke passed: ${collectionName} points=${pointsCount}.`);
