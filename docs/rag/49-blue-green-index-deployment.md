# RAG Blue-Green Index Deployment

This runbook keeps the active `babyloop_rag` collection untouched while a new versioned Qdrant collection is built and verified.

## Collections

- Stable runtime alias: `babyloop_rag_active`
- Current physical fallback: `babyloop_rag`
- Candidate format: `babyloop_rag_vYYYYMMDD_HHMMSS`

Candidate names may contain only letters, numbers and underscores. A candidate cannot be `babyloop_rag`, `babyloop_rag_active`, the configured runtime collection, or an existing alias name.

## 1. Build Candidate

```sh
CANDIDATE="babyloop_rag_v$(date +%Y%m%d_%H%M%S)"

RAG_INDEX_BUILD_ENABLED=true \
RAG_INDEX_TARGET_COLLECTION="$CANDIDATE" \
pnpm rag:index:build
```

Build creates the candidate collection, validates governance metadata, chunks `docs/rag`, creates Gemini embeddings, and upserts only into the candidate collection. It does not activate the alias.

## 2. Validate Candidate

```sh
RAG_INDEX_TARGET_COLLECTION="$CANDIDATE" \
pnpm rag:index:validate
```

Validation checks collection health, vector size, point count, required metadata, duplicate `chunkId`, embedding model consistency, index version consistency, and presence of the feeding canonical owner/topic.

## 3. Live Retrieval Acceptance

```sh
RAG_ACCEPTANCE_COLLECTION="$CANDIDATE" \
pnpm rag:acceptance:live
```

Acceptance runs real domain routing, Gemini embedding, Qdrant retrieval, owner policy, and grounding checks against launch-critical queries. Output is limited to safe diagnostics: domain, confidence, owner, source topics, source count, grounding status, and errors.

## 4. Inspect Qdrant Before Activation

```sh
curl -sS http://localhost:6333/collections
curl -sS http://localhost:6333/aliases
```

Do not print API keys or raw vectors.

## 5. Activate Alias

```sh
RAG_INDEX_ACTIVATE_ENABLED=true \
RAG_INDEX_ACTIVATE_CONFIRM=ACTIVATE_RAG_INDEX \
RAG_INDEX_TARGET_COLLECTION="$CANDIDATE" \
RAG_INDEX_ALIAS=babyloop_rag_active \
pnpm rag:index:activate
```

Activation reruns validation and live acceptance first. If both pass, it switches `babyloop_rag_active` to the candidate with one Qdrant aliases API request. It does not delete any collection.

Set API runtime to use the stable alias:

```sh
RAG_QDRANT_COLLECTION=babyloop_rag_active
RAG_INDEX_VERSION="$CANDIDATE"
```

`RAG_INDEX_VERSION` separates RAG cache keys after alias switches. Do not flush all Redis just to activate a new index.

## 6. Verify After Activation

```sh
curl -sS http://localhost:6333/aliases
curl -sS "http://localhost:6333/collections/$CANDIDATE"
```

The alias target should be the candidate collection, and the candidate should remain green with the expected point count.

## 7. Rollback

```sh
RAG_INDEX_ROLLBACK_ENABLED=true \
RAG_INDEX_ROLLBACK_CONFIRM=ROLLBACK_RAG_INDEX \
RAG_INDEX_ROLLBACK_COLLECTION=babyloop_rag \
RAG_INDEX_ALIAS=babyloop_rag_active \
pnpm rag:index:rollback
```

Rollback verifies the target collection exists, is green, has the expected vector size, and contains points before switching the alias. It does not delete the failed candidate.

## Failure Rules

- Build failure: do not activate; inspect the candidate or create a new candidate.
- Validation failure: do not activate; fix metadata/indexing and rebuild.
- Acceptance failure: do not activate; do not fall back to unrelated vector matches.
- Activation failure: alias remains unchanged unless Qdrant reports otherwise; inspect aliases before retrying.
- Cleanup is manual and out of scope for launch-critical activation. Never delete `babyloop_rag` as part of this flow.
