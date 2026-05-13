# AI Architecture

## AI Principles

- AI assists; humans own high-impact decisions.
- Every AI task must be logged with prompt version, model/provider, input, output, confidence, risk score, and timestamps.
- Critical baby safety categories receive warnings and checklists, not guarantees.
- Moderation uses behavior-based risk scoring, never direct gender-based punishment.
- RAG answers must use retrieved source ids in logs and explain uncertainty to users.
- Admin AI access to database analytics must be read-only and scoped.

## MVP AI Boundary

The first AI implementation should be narrow:

- build AI task logging and prompt version references before user-facing AI features
- implement listing helper v1 from seller text and structured listing fields
- implement valuation v1 from listing metadata and comparable listings
- defer vision-based condition analysis, RAG, recommendations, admin analytics assistant, and swap matching
- do not let AI publish, remove, restrict, or ban without application rules and review gates

Inputs listed in the module table are target-state inputs. Early versions should use the smallest reliable subset and mark unavailable signals as missing rather than faking them.

## Responsibility Boundaries

| Layer | Owns |
| --- | --- |
| AI provider | Raw model response, embeddings, or vision output. |
| `packages/ai-core` | Provider abstraction, prompt selection, structured output validation, task log helpers. |
| Feature service | Business context, allowed actions, confidence thresholds, and entity updates. |
| Moderation/admin UI | Human review, override reason, and final high-impact decision. |
| Database/audit layer | Immutable records of AI output, human decisions, and sensitive actions. |

AI modules should return recommendations and structured evidence. Application services decide whether a recommendation changes user-visible state.

## AI Modules

| Module | Inputs | Outputs | Human review |
| --- | --- | --- | --- |
| Product Valuation Engine | Category, brand, model, condition, age, photos, similar listings, transactions, market trends | Price range, listing price, fast-sale price, swap value, confidence, reasoning, missing info | Required for low confidence or high-value/safety categories |
| Listing Generator | Seller text, photos metadata, category hints, policy rules | Title, description, tags, category, attributes, missing questions, unsafe-claim flags | Required for unsafe or misleading claims |
| Condition Analyzer | Product photos, category, seller claims | Visible wear notes, stains/damage hints, missing-piece questions, hygiene risks, safety warnings | Required for safety-sensitive categories |
| RAG Parent/Product Assistant | User question, profile context, listing context, retrieved docs | Answer, uncertainty notes, policy references, recommended next action, optional listings | Required for unsafe advice reports |
| Message Moderation | Message text, conversation history, user behavior signals | Action, risk score, reason codes, warning text, escalation flag | Required for restrictions/bans |
| Fraud/Risk Detection | Listing data, image hashes, user history, price anomalies, behavior | Risk score, reason codes, review recommendation | Required for severe actions |
| Recommendation Engine | Events, child age, favorites, purchases, budget, location, brands | Ranked listings/categories, explanation labels, recommendation type | Not usually required, but should be auditable |
| Trade/Swap Matching Engine | User wants, product values, location, category compatibility | Compatibility score, fair difference payment, offer draft | Optional review for disputed swaps |
| Admin AI Analytics Assistant | Read-only metrics, event aggregates, admin question | SQL/metric plan, answer, charts/tables, caveats | Admin confirms actions separately |
| AI Audit and Prompt Versioning | All AI task metadata | Immutable task records and version traceability | Super admin approves production prompt versions |

## Provider Abstraction

Use a provider-neutral AI interface in `packages/ai-core` later:

| Concern | Requirement |
| --- | --- |
| Chat/completion | OpenAI-compatible structured output interface. |
| Embeddings | Provider-agnostic embedding generation with model metadata. |
| Vision | Optional multimodal interface for condition analysis. |
| Moderation | Dedicated moderation task API with normalized risk categories. |
| Retries/timeouts | Centralized policies per task type. |
| Cost tracking | Store token usage, model, latency, and estimated cost where available. |

The application should not call provider SDKs directly from feature modules. Feature modules call AI task services, and task services call the provider abstraction.

## Prompt Versioning

Prompt versions should be first-class records:

| Field | Purpose |
| --- | --- |
| prompt_key | Stable identifier such as `listing_generator.v1`. |
| version | Semantic or numeric version. |
| status | Draft, staging, production, archived. |
| template | Prompt content with explicit input variables. |
| output_schema | Structured output schema reference. |
| safety_notes | Known safety constraints and refusal rules. |
| approved_by | Super admin or authorized reviewer. |
| created_at | Version creation timestamp. |

Production AI tasks must reference an approved prompt version.

## AI Audit Logs

Every AI decision should eventually store:

- task type
- entity type and entity id
- user id if applicable
- input snapshot
- output snapshot
- provider and model
- prompt key and version
- retrieved context ids
- confidence score
- risk score
- action recommendation
- human override status
- human reviewer id
- latency, token usage, and cost metadata when available
- created_at

AI logs should be append-only. Corrections should be stored as follow-up review or override records.

AI log snapshots must be privacy-aware. Store the minimum useful input, redact unnecessary personal data, reference media files by id instead of copying binaries, and restrict staff access to raw message/listing snapshots.

## Human-in-the-Loop Flows

| Scenario | AI action | Human action |
| --- | --- | --- |
| Low-confidence valuation | Suggest missing info and provisional range | Seller completes fields or moderator reviews high-value item |
| Safety-sensitive listing | Ask seller questions and show warnings | Moderator can hold listing before publish |
| Suspicious message | Warn, block, or queue depending on severity | Moderator confirms restrictions |
| Fraud signal | Add review flag and reduce listing visibility if needed | Moderator investigates and resolves |
| Admin analytics recommendation | Provide read-only insight | Admin decides operational action separately |

## Risk and Moderation Flow

1. User creates message or listing.
2. System collects content and behavior signals.
3. AI moderation returns action, score, reason codes, and uncertainty.
4. Low-risk content is allowed.
5. Medium-risk content may show warning, rate-limit, or queue for review.
6. High-risk content can be blocked temporarily and sent to moderation.
7. Temporary restrictions and ban recommendations require human review.
8. All steps are logged in AI task logs and moderation decision logs.

## RAG Design

Knowledge sources:

- platform rules
- return/swap/rental policies
- safety checklists
- product category guides
- age/size guides
- listing quality guides
- moderation policy
- seller/buyer help docs

Core retrieval flow:

1. Store documents as versioned knowledge base entries.
2. Split entries into chunks with source metadata.
3. Generate embeddings and store in pgvector.
4. Retrieve top relevant chunks for a question.
5. Apply safety filters and prompt-injection checks.
6. Generate answer with uncertainty and scope boundaries.
7. Log retrieved chunk ids and final answer.

RAG should not treat user-provided listing content as trusted policy context.

## Recommendation Design

Start simple and auditable:

- content-based matching from category, brand, price, location, condition, and child age
- behavior signals from views, searches, favorites, messages, purchases
- exclusion rules for hidden, blocked, sold, or risky listings
- explanation labels such as "matches saved search" or "next-stage item for 6-9 months"

Later phases can add collaborative filtering, learning-to-rank, and real-time personalization.

## Valuation Design

Valuation should combine:

- category baseline rules
- brand/model normalization
- condition and age adjustments
- comparable active listings
- comparable sold transactions
- local market/location factors
- photo condition signals when available
- market trend signals later

Output must include:

- estimated price range
- recommended listing price
- fast-sale price
- swap value
- confidence score
- reasoning summary
- missing information checklist

For car seats, cribs, and safety products, valuation should add safety-sensitive warnings and avoid implying that a product is safe to use.
