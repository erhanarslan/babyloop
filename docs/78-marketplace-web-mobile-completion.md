# Marketplace + Web + Mobile Product Completion Mega Sprint

Codex did not run tests.

This document is the central release inventory for the marketplace, web functional, mobile functional, and SEO-lite completion sprint. It records what can be counted as a close candidate after local validation, what remains inventory-only, and what stays explicitly deferred.

## Non-Negotiable Disabled Boundaries

- No real email send
- No real push send
- No real n8n webhook execution
- No real queue worker
- No real payment/Iyzico
- No real S3/R2 migration
- S22/Maestro real-device smoke deferred

## Marketplace Core Coverage

| Item | Status after this sprint | Evidence |
| --- | --- | --- |
| #204 Saved searches web UI | Close candidate after validation | `/account/saved-searches` has list/create/delete, loading/empty/error, notification preference context. |
| #205 Saved searches API negative/security tests | Close candidate after validation | `saved-searches.routes.test.ts` covers auth, owner-only, invalid/unknown fields, no private response data. |
| #206 Seller dashboard foundation | Close candidate after validation | API and web seller dashboard expose own listing counts/status summaries only. |
| #207 Seller listing status management UX | Close candidate after validation | Web seller dashboard and listing services support status actions through owner-only APIs. |
| #208 Listing archive/restore/sold/reserved UX consistency | Close candidate after validation | Status allowlist is active/reserved/sold/archived; invalid transitions remain safe errors. |
| #209 Listing edit form hardening | Close candidate after validation | Update schema rejects unknown fields; owner-only update remains enforced; imageUrls bypass stays blocked. |
| #210 Listing image reorder/delete web UX polish sonrası tests | Close candidate after validation | Dedicated reorder/delete API and web listing image management inventory exist with owner-only tests. |
| #211 Listing image review public/admin consistency | Close candidate after validation | Public approved-only image behavior and admin review metadata inventory are covered by API tests. |
| #212 Browse filters mobile/web consistency | Close candidate after validation | Web/mobile filter clients use category/type/condition/price/city/sort/limit/offset contracts. |
| #213 Search result sorting/pagination regression | Close candidate after validation | `browse-routing.test.ts` and listing query schemas cover sort, limit, offset, and fallback behavior. |
| #214 Location/city filter dynamic source | Partial/inventory | City values are safe normalized in browse/search/product-event paths; full dynamic DB option source remains a later enhancement. |
| #215 Category landing SEO/data consistency | Close candidate after validation | Category/listing/profile metadata and sitemap/robots readiness are centralized in web SEO helpers. |
| #216 Favorites empty/error/loading states | Close candidate after validation | Web/mobile favorites surfaces include loading, empty, error, remove, and retry behavior. |
| #217 Favorites mobile integration | Close candidate after validation | Mobile favorites API/screen-state and listing detail favorite flow are wired. |
| #218 Messaging unread/read state web/mobile consistency | Close candidate after validation | Web/mobile message read-state models and notification reconciliation inventory exist. |
| #219 Conversation notification/read reconciliation | Close candidate after validation | Conversation read endpoints reconcile message notification unread counts. |
| #220 Report/block hidden menu UX final pass | Close candidate after validation | Public safety actions remain behind menu-style UI and tests/inventory guard that behavior. |
| #221 Public seller profile safe summary page | Close candidate after validation | `/profiles/:profileId` exposes display name, city, member-since, safety status copy, and safe aggregate stats only. |
| #222 Profile safety status user-facing behavior | Close candidate after validation | Restricted/suspended/profile-not-allowed states block unsafe interactions with safe copy. |
| #223 Product analytics event consistency | Close candidate after validation | Product event taxonomy now includes saved search, favorite, listing status, browse filter, and message sent events with no-PII payloads. |

## Web Functional Coverage

| Item | Status after this sprint | Evidence |
| --- | --- | --- |
| #224 Header lightweight final navigation | Close candidate after validation | Header and public navigation model keep key product routes without adding heavy feature sprawl. |
| #225 Responsive sidebar/hamburger navigation | Close candidate after validation | Mobile drawer remains the responsive navigation entry and has component tests/inventory. |
| #226 Mobile web layout consistency | Partial/inventory | Existing responsive layout coverage remains; visual QA still needed on real viewports. |
| #227 Home hero final copy/visual polish | Partial/inventory | No heavy visual polish was done; only functional state/copy inventory is tracked. |
| #228 Latest listings load-more behavior final tests | Close candidate after validation | Latest listings section and tests cover loading, batch, fallback, and privacy-safe render behavior. |
| #229 Nearby products section | Close candidate after validation | Home personalization/nearby inventory uses safe city/latest fallback without precise geolocation collection. |
| #230 Category mega menu icons/pastel set | Partial/inventory | Existing icon/config inventory is tracked; no new custom asset set was generated. |
| #231 Logo transparent PNG integration | Deferred | No asset was provided, so no transparent PNG integration was claimed. |
| #232 Background pattern light/dark polish | Deferred | No asset/pattern redesign in this sprint. |
| #233 Listing card fixed image/card ratio polish | Close candidate after validation | Shared listing image frame preserves stable ratio and object-fit behavior. |
| #234 User menu/profile/settings IA cleanup | Close candidate after validation | Account/profile/security/notification/child links are visible through existing IA. |
| #235 “Ebeveyn yorumları” yerine child notebook/reminder nav | Close candidate after validation | Child profile notebook/reminder surfaces are the child-data navigation target. |
| #236 Assistant/RAG entry point UX | Close candidate after validation | Assistant entry remains safe-scope and provider-disabled; no medical/therapy/diagnosis/drug/diet advice. |

### Web P0 feature completion

- Web auth now separates real 401/403 session rejection from network/API-unavailable failures; network errors must not silently log the user out.
- Web auth navigation performs initial cookie-session restore without 5-second polling and relies on shared refresh/current-user in-flight requests.
- Web login supports the real MFA challenge flow with a six-digit OTP stage before authenticated state or mobile approval continuation.
- Web Assistant uses `/api/v1/assistant/messages` and renders normalized `mode`, `grounded`, safe sources, tool previews, and allowlisted internal suggested actions.
- Boundary and no-source assistant responses are not displayed as sourced RAG answers, and raw source paths/provider metadata stay out of the UI.
- Web visual listing draft uses `/api/v1/listings/ai-draft-suggestions`; suggestions are non-blocking, require explicit user apply, and only fill empty title/description/category fields.
- Web child notebook/reminder UI renders only real notes/reminders; fake preview rows such as demo feeding/diaper reminders are not production data.
- Web child reminders use the same schedule kinds as the API: `one_time`, `daily`, `weekly`, `interval`, and `relative_before_event`.
- `pnpm security:web-p0-feature-completion`, targeted web tests, and manual browser QA must pass before claiming browser release readiness.
| #237 Empty/error/loading skeleton consistency | Close candidate after validation | Saved searches, seller dashboard, favorites, browse, assistant, and account pages expose loading/error/empty surfaces. |
| #238 A11y/keyboard/focus visible pass | Partial/inventory | Accessible menu/input/button inventory exists; manual keyboard/focus QA remains recommended. |

## Mobile Functional Coverage

| Item | Status after this sprint | Evidence |
| --- | --- | --- |
| #239 Mobile bottom tab icon set replacement | Partial/inventory | Existing icon library is used; no custom asset set was introduced. |
| #240 Android navigation bar safe-area behavior | Close candidate after validation | Android navigation utilities and mobile layout helpers gate tab/safe-area behavior. |
| #241 Mobile listings browse filter UX | Close candidate after validation | Browse screen and API model preserve category/type/condition/city/sort parameters. |
| #242 Mobile listing detail final UX | Close candidate after validation | Listing detail has safe seller summary, favorite/message actions, and hidden safety actions. |
| #243 Mobile sell listing image upload flow | Close candidate after validation | Sell API/model supports image upload limits, delete/reorder inventory, and safe error states. |
| #244 Mobile favorites final flow | Close candidate after validation | Favorites screen/API handle auth, loading, empty, error, list, and detail navigation. |
| #245 Mobile messaging realtime integration smoke/model | Close candidate after validation | Realtime model tests/inventory cover safe payloads and read-state expectations. |
| #246 Mobile notifications screen real data smoke/model | Close candidate after validation | Notifications screen uses real notification API, read actions, lifecycle generation, and preference fetch. |
| #247 Mobile notification preferences full UI | Close candidate after validation | Notifications screen now exposes source/channel preference state and in-app message toggle. |
| #248 Mobile child profile/child notebook/reminder full UI | Close candidate after validation | Child profile route, notes/reminders API/model/screen-state foundations exist. |
| #249 Mobile auth biometric/security settings opsiyonları | Partial/inventory | Security readiness/settings exist; no native biometric secret flow was enabled. |
| #250 Mobile OTP/MFA real-device manual QA | Deferred | S22/Maestro real-device smoke deferred until device evidence exists. |
| #251 Mobile release build profile review | Partial/inventory | Mobile README/runbook and P0 gate inventory exist; real store build remains later. |
| #252 Mobile README/runbook finalization | Close candidate after validation | Mobile README documents start commands, P0 gates, and real-device limitations. |

### Mobile assistant, reminder picker, and AI listing draft completion

- Mobile RAG assistant now uses `/api/v1/assistant/messages` response fields for `mode`, `grounded`, sources, tool previews, and safe internal suggested actions.
- Boundary and no-source assistant responses stay visually distinct from sourced RAG answers.
- Mobile child reminders use the native `@react-native-community/datetimepicker` path instead of the incorrect `NativeModules.RNCDatePicker` check.
- Mobile visual listing draft uses `/api/v1/listings/ai-draft-suggestions` and remains non-blocking: AI failure does not block manual listing creation.
- AI listing draft suggestions require an explicit user apply action and only fill empty title/description/category fields.
- AI does not auto-apply price, condition, listing type, or publish a listing.
- Real-device Galaxy S22 QA is still deferred until manual device evidence exists.

## SEO-Lite

| Item | Status after this sprint | Evidence |
| --- | --- | --- |
| #264 SEO robots/sitemap/opengraph production readiness | Close candidate after validation | Robots, sitemap, OpenGraph image, listing/category/profile metadata helpers and tests/inventory exist. |

## Deferred Items

- #137 Mobile Maestro / S22 real-device smoke remains deferred.
- #159 Mobile S22 real-device smoke / Maestro retry remains deferred.
- #250 Mobile OTP/MFA real-device manual QA remains deferred.
- #253 Play Store/TestFlight readiness remains deferred.
- #254-#263 real DevOps/infra/deploy items remain deferred.
- #265 Payment/Iyzico remains deferred.

## No-PII Analytics Checklist

- Allowed analytics payload fields: `listingId`, `categoryId`, `savedSearchId`, `conversationId`, `city`, `status`, `sort`, `listingType`, `condition`, `limit`, `offset`, `source`, `queryLength`, and aggregate result count buckets.
- Disallowed analytics payload fields: accessToken, refreshToken, passwordHash, cookie, authorization, email, phone, raw message body, OTP, provider secret, webhook secret, push token, raw search query.
- Product event routes use strict schemas and metadata allowlists.
- Saved search, favorite, listing status, browse filter, and message events are no-PII by design.

## Public/Admin DTO No-Leak Checklist

- Public listing, favorites, profile, messaging, and notification DTOs must not expose email, phone, internal user id, token, hash, raw provider output, raw storage path, raw message body, or moderation-only enforcement reasons.
- Backoffice default responses remain redacted; sensitive access requires reason/fields/admin/audit surfaces.
- Seller profile summary is limited to profileId, display name, location city, created/member-since style values, and safe aggregate stats.
- Report/block actions stay hidden behind menu-style UI and do not become prominent public accusations.

## Local Validation Commands

```bash
pnpm security:marketplace-web-mobile-completion
pnpm security:mobile-ai-rag-listing
pnpm release:mobile:p0
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm test:api:security
pnpm beta:critical-smoke
```

Optional targeted checks:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm --filter @babyloop/api exec vitest run --config vitest.config.ts test/saved-searches.routes.test.ts test/listings.integration.test.ts test/favorites.integration.test.ts test/messaging.integration.test.ts test/public-profiles.routes.test.ts test/product-events.routes.test.ts
pnpm --filter @babyloop/mobile exec jest --runInBand --runTestsByPath src/features/listings/listing-labels.test.ts src/features/notifications/notifications-api.test.ts src/features/notifications/notification-preferences-model.test.ts src/features/child/child-reminders-api.test.ts src/features/child/child-reminder-screen-state-model.test.ts
pnpm --filter @babyloop/web exec vitest run src/features/favorites/favorite-card.test.tsx src/features/listings/browse-routing.test.ts src/features/home/home-latest-listings-section.test.tsx src/lib/seo.test.ts
```

- Web functional completion inventory includes child notebook notes and reminders quick navigation when child data exists.

## Web functional completion inventory sentinel

Web functional completion inventory covers child notebook notes and reminders quick navigation when child data exists.
