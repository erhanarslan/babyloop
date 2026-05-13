# Feature Map

## MVP Features

The MVP should prove the core marketplace plus the first safe AI loop.

MVP here means the first credible public-beta product, not the next implementation step. The implementation roadmap should still deliver this through smaller vertical slices.

| Area | Features |
| --- | --- |
| Auth and profiles | Sign up, sign in, user profile, parent profile basics. |
| Listings | Create, edit, publish, archive, image upload, category, condition, price, location. |
| Discovery | Search, filters, listing detail page, favorites. |
| Messaging | Buyer-seller conversation, basic anti-spam checks, report message. |
| AI valuation v1 | Structured price suggestion from listing fields and simple comparable listing lookup. |
| AI listing helper v1 | Generate title, description, tags, missing-info checklist. |
| Moderation v1 | Listing/message risk scoring, moderation queue, human review. |
| Admin v1 | User/listing/message moderation views and basic marketplace metrics. |
| AI audit v1 | Log AI task input, output, model, prompt version, confidence, risk score, and human override status. |
| Analytics v1 | Event tracking for views, searches, favorites, messages, and listing creation. |

## MVP Exclusions

These are intentionally outside the first public-beta MVP:

- native mobile app
- real payment processing and escrow-like flows
- full rental lifecycle
- production WhatsApp, Telegram, or Instagram automation
- advanced photo condition analysis
- collaborative filtering or learning-to-rank recommendations
- fully autonomous bans or irreversible AI decisions

These exclusions are schedule boundaries, not product-scope removals. Admin tooling is part of the public-beta MVP through moderation and analytics views. Mobile remains a core final product surface, but native Expo implementation starts only after the web and API contracts are stable.

## Phase 2 Features

| Area | Features |
| --- | --- |
| RAG assistant | Retrieval over platform rules, safety guides, size/age guides, listing tips, and policies. |
| Condition analysis | Photo-based visible condition hints and seller questions for safety-sensitive categories. |
| Recommendation v1 | Personalized listing/category recommendations using behavior and child profile age. |
| Swap matching v1 | Compatible swap suggestions, value comparison, difference payment suggestion. |
| Notifications v1 | Email and app notifications for saved searches, price drops, and stale listings. |
| Automation v1 | Background jobs for valuation, embeddings, moderation, stale listing reminders. |
| Admin analytics assistant v1 | Read-only natural language analytics over approved metrics and event tables. |

## Phase 3 Features

| Area | Features |
| --- | --- |
| Payments/order flow | Checkout, escrow-like states if needed, refunds, cancellation tracking. |
| Rental flow | Availability windows, deposits, late return states, rental policies. |
| Fraud detection | Copied photos, duplicate listings, unrealistic prices, suspicious new accounts. |
| Advanced recommendations | Hybrid collaborative/content-based ranking, price-drop and baby-stage recommendations. |
| Seller analytics | Conversion rate, average sale time, price quality, category demand. |
| Trust system | Reviews, transaction history, report rate, response rate, trust score. |
| Mobile readiness | Expo app shell after API contracts and core workflows stabilize. |

## Future Commercial Features

- verified professional seller accounts
- promoted listings and campaign management
- logistics/pickup integrations
- premium valuation certificates
- B2B inventory import/export
- affiliate recommendations for unavailable new products
- WhatsApp, Telegram, and Instagram-related workflows
- multi-region and multilingual support
- partner dashboards for stores or charities

## Feature Priority Table

| Priority | Feature | Reason |
| --- | --- | --- |
| P0 | Auth, profiles, listings, images | Marketplace cannot function without trusted identity and inventory. |
| P0 | Search, filters, listing detail | Buyers need discovery before transactions matter. |
| P0 | AI audit log foundation | AI safety and portfolio credibility depend on logging from the beginning. |
| P0 | AI listing helper v1 | High portfolio value and directly improves seller experience. |
| P0 | AI valuation v1 | Core differentiator and strong AI engineering proof point. |
| P0 | Basic moderation queue | Required before messaging and public content scale. |
| P1 | Messaging | Needed for buyer-seller negotiation. |
| P1 | Event analytics | Required for recommendations, admin insight, and product decisions. |
| P1 | RAG assistant | Strong AI feature after knowledge base and retrieval logging are ready. |
| P1 | Recommendations v1 | Needs enough event data to become meaningful. |
| P2 | Swap matching | Differentiator, but depends on valuation and messaging. |
| P2 | Notifications | Useful once saved searches/favorites exist. |
| P3 | Mobile app | Should wait until web/api contracts stabilize. |
| P3 | Payments/rentals | Commercially important, but larger compliance and edge-case surface. |
