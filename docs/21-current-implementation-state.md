# BabyLoop Current Implementation State

This document records the current implemented state after the mobile MFA/login-flow hardening work. It is not a wishlist and it does not claim production readiness.

## Current maturity

BabyLoop is now a broad local/staging-ready product foundation:

- Full-stack marketplace monorepo.
- Fastify API.
- Next.js public web.
- Dedicated Next.js backoffice.
- Expo/React Native mobile app.
- PostgreSQL + Drizzle schema.
- Auth/session/MFA/mobile approval foundation.
- Listing/favorites/messaging/notification foundations.
- Trust & Safety/backoffice foundation.
- Child profile/notes/reminders foundation.
- RAG/assistant foundation.
- Mock checkout/payment foundation.
- Growing API/web/backoffice/mobile test coverage.

The project is **demo/beta-foundation ready**, but **not production-ready** yet.

## Implemented or mostly implemented

| Area | Current state |
| --- | --- |
| Monorepo | pnpm workspace, Turborepo, TypeScript, shared packages, CI scripts, local infra scripts. |
| API | Auth, listings, favorites, messaging, notifications, reports/blocking, child profiles, saved searches, cart/mock checkout, RAG/assistant, backoffice/admin APIs. |
| Web | Home, browse, listing detail, sell, favorites, my listings, account/security, messages, notifications, child/profile surfaces, assistant, cart/checkout, SEO foundations. |
| Backoffice | Dedicated admin app with auth, dashboard, moderation cases, sensitive access, audit browser, listing review, image review, profiles, conversations, email/notification/storage/RAG/AI ops surfaces. |
| Mobile | Expo app with login/register, secure token storage, browse/detail, favorites, messages/realtime foundation, security/MFA/session controls, child notes/reminders with native date/time picker binding, notifications, sell/image model, user-approved AI listing draft helper, basket/mock checkout, assistant entry with RAG mode/source visibility. |
| Auth | Register/login/logout/refresh/me, password reset, email verification, Google OAuth foundation, MFA email OTP foundation, mobile client channel enforcement, mobile security toggles, mobile approval for web login. |
| Listings | Create/list/detail/my listings, status lifecycle, local image upload/review, privacy-safe seller DTOs, favorite counts, search/filter foundation. |
| Images | Local upload/safety/reorder/delete/review foundation. S3/R2 connection has been tested and must be wired into production storage mode. |
| Messaging | Conversation start/list/detail/send, moderation, read/unread, Socket.IO realtime foundation, block-aware restrictions. |
| Trust & Safety | Reports, blocking, moderation cases/actions/timeline, redaction, sensitive access, audit, profile/listing/message admin review foundations. |
| Notifications | In-app persistent notifications, unread/read flows, preferences, draft/delivery foundations, realtime notification foundation. |
| Child profiles | Child profiles, notes, reminders, lifecycle recommendation foundation, mobile child surfaces. |
| RAG/AI | Assistant/RAG services, safety boundaries, curated RAG docs, eval/ops foundations, mock/provider abstraction foundations, mobile RAG response mode/grounding/source display, and mobile visual-to-listing draft helper. AI draft suggestions are non-blocking and require user review before any listing submission. |
| Payment | Cart/order/mock checkout foundation; real payment collection intentionally disabled until company/legal setup exists. |
| Tests | API integration tests, web/backoffice unit and E2E smoke foundations, mobile Jest/P0 tests, shared tests, release smoke scripts. |

## Production blockers / remaining work

The following remain active and required:

- Repo hygiene and docs accuracy.
- Managed PostgreSQL migration.
- Queue/job infrastructure and n8n data pipeline.
- Production email provider.
- Google OAuth hardening.
- Full auth security review.
- S3/R2 production storage wiring and duplicate image checks.
- Advanced filtering, pagination, seller reviews/review counts.
- Redis adapter / Socket.IO scaling.
- Realtime duplicate/missing message controls, reconnect, offline queue.
- Image-only message attachments.
- Fraud prevention signals.
- Terms of Use, Privacy Policy, marketplace rules on web and mobile.
- Analytics/product-intelligence logging.
- Child notebook/reminders/lifecycle notifications end-to-end.
- Notification delivery, native push, n8n workflows.
- RAG/assistant production completion.
- Payment simulation with realistic commission/order/payment states.
- Full mobile completion.
- Exhaustive automated and manual QA support.
- Final web/mobile UI/UX polish after features are complete.
- Production DevOps/deployment/observability/backup/alerting package near the end.

## Removed from near-term roadmap

The following are intentionally out of near-term scope:

- Non-core rental-style marketplace flows.
- Multi-admin operations workflows.
- Enterprise moderation workload tracking.
- Multi-agent moderation matching.
- Unsupported document-style message attachments.

Rationale: the first real operating model is a single-admin product. Fraud prevention, legal surfaces, auth security, logging, and product completion are higher priority.
