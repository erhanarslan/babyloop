# MVP Roadmap

## Roadmap Principles

- The first public-beta MVP is complete only after the core marketplace, moderation, AI logging, listing helper, valuation, and messaging slices work together.
- Admin is a core product surface for the final platform and enters once moderation/admin workflows begin.
- Mobile is a core final product surface, but native Expo implementation is intentionally delayed until web/API contracts are stable.
- Build in small, testable phases.
- Do not create the mobile app before web and API contracts are stable.
- Do not build all AI modules at once.
- Start AI logging before advanced AI features.
- Prefer real vertical slices over broad unfinished scaffolding.
- Each phase must have local verification steps and done criteria.

## Phase 0: Documentation and Architecture

Scope:

- Product vision
- roles and permissions
- feature map
- AI architecture
- system architecture
- database design
- automation workflows
- MVP roadmap
- coding rules
- Codex working plan

Done criteria:

- All docs exist in `/docs`.
- No app code or dependencies are added.
- Next step is clear and small.

## Phase 1: Monorepo Foundation

Scope:

- pnpm workspace
- Turborepo config
- shared TypeScript config
- lint/format baseline
- environment variable conventions
- only the minimal app/package directories needed for the next slice: `apps/web`, `apps/api`, `packages/shared`, and `packages/config`

Delayed but still in final scope:

- `apps/admin`
- `apps/mobile`
- `apps/worker`
- `packages/database`
- `packages/ai-core`
- `packages/pricing-engine`
- `packages/recommendation-engine`
- `packages/moderation-engine`
- `packages/notification-engine`
- `packages/ui`

Done criteria:

- `pnpm install` works.
- `pnpm lint` or equivalent baseline command works.
- No product feature code yet.
- Folder boundaries match architecture docs without creating unused future packages.

## Phase 2: Database and API Foundation

Scope:

- PostgreSQL schema tooling
- core entities for users/profiles or auth references, categories, listings, listing media metadata, and events
- validation with Zod
- typed API response format
- health endpoint
- local database setup instructions

Done criteria:

- migrations run locally
- health endpoint returns success
- basic schema tests or migration verification pass

## Phase 3: Web Marketplace Vertical Slice

Scope:

- web app shell
- listing browse page
- listing detail page
- create listing draft
- image upload placeholder/storage interface
- event logging for listing view and creation

Done criteria:

- user can create and view a listing locally
- API validates listing input
- events are stored
- UI handles loading and errors

## Phase 4: Admin and Moderation Foundation

Scope:

- admin app shell
- moderation queue tables
- report listing/message API
- basic admin list/detail views
- audit log for admin decisions

Done criteria:

- reported listing appears in moderation queue
- moderator can mark allowed/removed/needs info
- decision is auditable

This phase can use deterministic/rules-based moderation first. AI-assisted moderation should wait until the AI logging foundation exists.

## Phase 5: AI Audit and Listing Helper v1

Scope:

- AI provider abstraction
- prompt version table
- AI task log table
- listing generator v1
- structured output validation
- seller review of generated suggestions

Done criteria:

- AI listing suggestion is generated from listing draft
- output is schema-validated
- AI task log stores input, output, model, provider, prompt version, and status
- seller can accept or edit suggestions

## Phase 6: Valuation v1

Scope:

- pricing-engine package
- comparable listing lookup
- structured valuation output
- missing information checklist
- safety-sensitive category warnings

Done criteria:

- listing receives price range and recommended price
- low-confidence valuation asks for missing data
- valuation result is logged and visible to seller/admin

## Phase 7: Messaging and Moderation v1

Scope:

- conversations and messages
- message reporting
- AI/rules-based moderation task
- warning/block/queue states

Done criteria:

- users can message about a listing
- risky message can be queued or blocked
- moderator can review and override
- moderation logs are auditable

At the end of this phase, BabyLoop has the first public-beta MVP loop: users can create listings, discover products, contact each other, receive AI listing/valuation help, and have risky content reviewed.

## Phase 8: RAG Assistant v1

Scope:

- knowledge document tables
- chunking and embeddings
- retrieval over platform guides and policies
- assistant endpoint with logged retrieved context ids

Done criteria:

- assistant answers from approved knowledge base
- retrieved chunk ids are logged
- answer includes uncertainty where appropriate
- prompt injection risks are documented and tested with basic cases

## Phase 9: Recommendations and Automations v1

Scope:

- favorites and saved searches
- event aggregates
- simple recommendation ranking
- stale listing and price-drop notifications

Done criteria:

- user sees recommendations based on behavior and child age
- saved-search notification job can run locally
- stale listing job creates seller suggestion

## Phase 10: Commercial Readiness Expansion

Scope:

- swap matching
- rentals
- payments
- advanced fraud checks
- seller analytics
- mobile app planning

Done criteria:

- each feature is added as its own vertical slice
- no mobile implementation starts until API stability is confirmed
