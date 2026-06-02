# Database Design

## Main Entities

| Entity | Purpose |
| --- | --- |
| User | Account identity, status, trust signals. |
| User profile | Public profile, location, preferences, seller/buyer metadata. |
| Parent profile | Child age range, stage needs, budget, preferred brands. |
| Listing | Product listing for sale, swap, donation, or rent. |
| Product category | Category tree and safety-sensitive flags. |
| Listing media | Product photos/videos and moderation metadata. |
| Offer/order | Buy, rent, donation, and offer state tracking. |
| Swap offer | Proposed product-for-product exchange and value difference. |
| Conversation/message | Buyer-seller messaging and moderation state. |
| Favorite/search | Saved listings and saved searches. |
| Review/report | User feedback, trust, and moderation reports. |
| AI task log | Full AI input/output/audit metadata. |
| Prompt version | Versioned prompt templates and approvals. |
| Knowledge document/chunk | RAG source documents and embeddings. |
| Event | Product, user, and platform analytics events. |

## Table Groups

| Group | Example tables |
| --- | --- |
| Identity | `users`, `user_profiles`, `user_roles`, `staff_permissions`, `parent_profiles`, `children` |
| Marketplace | `categories`, `brands`, `product_models`, `listings`, `listing_attributes`, `listing_media`, `listing_sets` |
| Transactions | `offers`, `orders`, `rentals`, `donation_requests`, `swap_offers`, `swap_offer_items` |
| Messaging | `conversations`, `conversation_participants`, `messages`, `message_delivery_states` |
| Trust/moderation | `reports`, `moderation_cases`, `moderation_decisions`, `user_restrictions`, `risk_signals` |
| AI | `ai_task_logs`, `prompt_versions`, `ai_human_overrides`, `valuation_results`, `condition_analysis_results` |
| RAG | `knowledge_documents`, `knowledge_chunks`, `knowledge_embeddings`, `rag_sessions` |
| Recommendations | `recommendation_events`, `recommendation_results`, `saved_searches`, `favorites` |
| Analytics | `events`, `daily_user_metrics`, `daily_listing_metrics`, `daily_platform_metrics`, `search_term_stats` |
| Audit | `audit_logs`, `admin_actions`, `data_access_logs` |

## MVP Schema Boundary

Do not create every target-state table in the first database phase. Start with the tables needed for the active vertical slice:

- users/profiles or auth integration references
- categories
- listings and listing media metadata
- events
- reports/moderation cases when moderation begins
- prompt versions and AI task logs when AI begins

Defer rentals, payments, swaps, RAG chunks, recommendation results, aggregate analytics tables, and advanced fraud tables until their roadmap phase starts.

Migration safety is tracked separately in `docs/26-database-migration-safety-audit.md`. Before production, review that audit for backfill-sensitive migrations, especially messaging and future enum changes.

## Ownership and Access Rules

| Area | Owner |
| --- | --- |
| Schema and migrations | `packages/database` |
| API writes and transactions | `apps/api` services |
| Background job result writes | `apps/worker` through approved helpers |
| Web/admin data access | API only |
| Admin AI analytics | Read-only views or aggregate tables |
| Feature packages | Domain logic and types, not direct ownership of unrelated tables |

## Important Relationships

- A user can have many roles, listings, conversations, offers, reports, and events.
- A parent profile belongs to a user and can have one or more children/stage records.
- A listing belongs to a seller, category, location, and optional brand/model.
- A listing can have many media records, attributes, favorites, messages, offers, AI results, and analytics events.
- A conversation connects participants and can reference a listing or offer.
- A moderation case can reference a listing, message, user, image, or report.
- An AI task log can reference any entity through `entity_type` and `entity_id`.
- A prompt version can be used by many AI task logs.
- A knowledge document has many chunks; chunks have embeddings and retrieval metadata.
- A swap offer has offered items, requested items, valuation references, and optional difference payment.

## Event Tracking Model

Use append-only events for product and user analytics.

| Field | Purpose |
| --- | --- |
| event_id | Unique event id. |
| event_type | Examples: `listing_viewed`, `search_submitted`, `favorite_added`, `message_started`. |
| actor_user_id | Nullable for guests. |
| session_id | Anonymous or authenticated session tracking. |
| entity_type/entity_id | Listing, category, search, message, order, etc. |
| properties | JSON payload with filters, rank position, source, device, etc. |
| occurred_at | Event timestamp. |

Events should feed daily aggregate tables for admin dashboards and recommendation features.

Event properties must avoid unnecessary personal data. Store references, normalized categories, and safe metadata instead of raw private message content whenever possible.

## AI Log Tables

Minimum AI log structure:

| Table | Purpose |
| --- | --- |
| `ai_task_logs` | Stores task type, entity reference, input/output snapshots, model, provider, prompt version, confidence, risk, status, latency, token/cost metadata. |
| `prompt_versions` | Stores approved and draft prompt templates, schemas, safety notes, and approval metadata. |
| `ai_human_overrides` | Stores reviewer decision, previous AI recommendation, final decision, reason, and reviewer id. |
| `valuation_results` | Stores normalized valuation output for listings and swaps. |
| `condition_analysis_results` | Stores photo analysis summaries and warnings. |

AI logs should be append-only. If output is corrected, create an override or superseding task. Input/output snapshots should be minimized and redacted where possible, especially for private messages, contact details, child profile data, and user location.

## RAG Tables

| Table | Purpose |
| --- | --- |
| `knowledge_documents` | Source-level metadata, status, version, audience, safety category. |
| `knowledge_chunks` | Chunk text, token count, source position, document version. |
| `knowledge_embeddings` | pgvector embedding and model metadata for each chunk. |
| `rag_sessions` | User/admin question, retrieved chunk ids, answer metadata, and safety flags. |

## Moderation Tables

| Table | Purpose |
| --- | --- |
| `reports` | User-generated reports against listings, users, messages, or media. |
| `moderation_cases` | Work queue item with status, priority, entity reference, and assigned reviewer. |
| `moderation_decisions` | Human or AI-assisted decision records. |
| `user_restrictions` | Warnings, rate limits, temporary restrictions, bans, and expiry. |
| `risk_signals` | Behavior-based signals used for fraud or abuse scoring. |

## Swap and Trade Tables

| Table | Purpose |
| --- | --- |
| `swap_offers` | Offer state, participants, compatibility score, valuation summary. |
| `swap_offer_items` | Listings included in each side of the trade. |
| `swap_value_adjustments` | Suggested difference payment and explanation. |
| `swap_messages` | Optional structured offer messages or references to conversations. |

## Analytics Tables

Daily aggregate tables should be built from events:

- `daily_user_metrics`: orders, spending, sales, activity, replies, conversion, cancellations, reports, trust score.
- `daily_listing_metrics`: views, favorites, messages, price drops, sale time, traffic source, search terms.
- `daily_platform_metrics`: DAU, WAU, new listings, sold products, swap offers, message volume, risky message rate.
- `search_term_stats`: searched terms, result count, conversion, under-supply signal.

Raw events are the source of truth; aggregate tables optimize dashboards and admin AI queries.
