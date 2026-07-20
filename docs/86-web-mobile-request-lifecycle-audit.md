# Web + Mobile Request Lifecycle Audit

Date: 2026-07-20
Scope: Patch 17 + Patch 18 combined

## Objective

This audit closes high-impact request duplication and lifecycle risks after marketplace pagination hardening. It covers initial auth bootstrap, global shell traffic, page/screen request ownership, timers, focus/AppState refreshes, realtime listeners, request cancellation, payload size, and fresh-database CI reliability.

## Applied fixes

### Web auth and shell

- `refreshSession` remains single-flight so concurrent header, auth navigation, and page consumers share one refresh request.
- `/auth/me` is single-flight and now uses a 30-second token-bound snapshot cache.
- Successful login, registration, MFA, mobile approval, and refresh responses seed the current-user snapshot directly; they no longer require an immediate `/auth/me` round trip.
- Logout clears token, CSRF, auth snapshot, and in-flight state together.
- Header cart badge uses `GET /api/v1/cart/summary` instead of downloading the complete cart payload.
- Notification unread-count requests retain short-window request coalescing; the full notification list is fetched only when the menu opens.

### Web home and marketplace

- Latest-listing rotator no longer performs one listing-detail request per card.
- Public listing summaries include `locationCity`, allowing one list request to render the rotator.
- Rotator requests are aborted on unmount and animation stops while the document is hidden.
- Browse, category, and home feeds continue to use deterministic 20-item infinite-scroll pages from Patch 16.

### Mobile startup and lifecycle

- SecureStore token hydration is single-flight during cold start.
- Refresh-token recovery is already single-flight.
- Conversation list ownership remains centralized in one root provider, with in-flight dedupe, a 30-second AppState resume freshness window, and realtime merge instead of full-list refetch.
- Hidden Favorites remains a route, not a mounted tab; it does not perform background tab fetches.
- Browse continuation requests remain offset-locked and abort stale work.

### API and database

- Added a lightweight cart summary endpoint returning available and unavailable item counts only.
- Public listing summary now carries seller city without a detail N+1.
- Reworked historic `listing_status` migration 0008 to replace the enum in one transaction instead of using `ALTER TYPE ... ADD VALUE` and then referencing the new value later in the same fresh migration transaction.
- Added a fresh migration-chain regression that verifies enum order and prevents PostgreSQL `55P04` CI cascades.

## Web page → endpoint ownership

| Surface | Initial/owned endpoints | Lifecycle rule |
|---|---|---|
| Global shell | `/auth/refresh`, `/auth/me`, `/notifications/unread-count`, `/cart/summary` | Auth and unread requests coalesce; cart is summary-only |
| Home | `/listings?limit=20...`, `/listings?limit=3...` | No detail N+1; feed pages append by 20 |
| Browse/category | `/listings`, `/categories` | Abort stale filter requests; continuation pages skip total count |
| Listing detail | `/listings/:id` | Detail owns viewer state; no separate favorite-state endpoint |
| Favorites | `/favorites` | Fetch only on route entry or explicit mutation |
| Cart | `/cart` | Full payload only on cart page; shell uses `/cart/summary` |
| Conversations | `/conversations` | Realtime updates merge locally; reconnect may refresh once |
| Message thread | `/conversations/:id`, `/messages`, `/read` | Listener cleanup required; delayed read timer cleared |
| Notifications | `/notifications`, `/unread-count` | Header fetches count first; full list is lazy |
| Child profiles | `/child-profiles`, notes/reminders/recommendations | Screen owns data; mutation refreshes only affected state |
| Account/security | auth session, MFA, approval endpoints | No global polling; explicit or focus-bound reads only |
| Analytics | `/analytics/events/batch` | Bounded queue, heartbeat only while consent/session permits |

## Mobile screen → endpoint ownership

| Screen/provider | Initial/owned endpoints | Lifecycle rule |
|---|---|---|
| AuthSessionProvider | `/auth/me` or `/auth/refresh` | One cold-start owner; SecureStore and refresh single-flight |
| ConversationListProvider | `/conversations` | One root owner; 30s resume TTL; realtime merge |
| Keşfet | `/listings`, `/categories` | 20-item pages; same offset cannot run twice; stale requests abort |
| Listing detail | `/listings/:id` | Detail owns viewer state and action state |
| Mesajlar | shared conversation provider | Tab does not issue a duplicate list request |
| Conversation detail | detail/messages/read endpoints | Screen-scoped realtime subscription and cleanup |
| Sepetim | `/cart` | Full payload only while focused |
| Favoriler | `/favorites` | Hidden route; fetches only when opened from Account |
| İlanlarım | `/me/listings` | Focus/AppState-aware pending-publication backoff |
| Bildirimler | notifications and preferences endpoints | Explicit screen ownership; no background polling |
| AnalyticsProvider | `/analytics/events/batch` | Queue and bounded heartbeat; AppState flush |
| Push bootstrap | push token endpoints | Retry timer bounded and removed on unmount/AppState change |

## Polling and timer classification

Allowed timers are classified as one of:

1. UI animation timers that stop on blur/visibility/unmount.
2. Bounded auth approval polling with expiry and in-flight lock.
3. Analytics heartbeat/flush timers with consent/AppState guards.
4. Publication-state backoff that stops when the page/screen is inactive.
5. Push-registration retry timers with bounded delay and cleanup.

Transport modules (`auth-client`, mobile auth API, cart API, messaging API) may not start polling intervals.

## Realtime listener requirements

Every web `socket.on(event, handler)` must have a matching `socket.off(event, handler)` in the same lifecycle effect. Mobile realtime is centralized and returns an explicit `unsubscribe()` contract. Reconnect handlers may trigger one coalesced refresh, not parallel screen and badge refreshes.

## Automated controls

- `pnpm audit:api-traffic` prints request, endpoint, timer, and listener inventory.
- `pnpm audit:api-traffic:json` emits machine-readable inventory.
- `pnpm security:web-mobile-request-lifecycle` enforces auth coalescing, shell summary payloads, N+1 removal, mobile hydration single-flight, socket cleanup, and fresh enum migration safety.
- `pnpm test:api:fresh-migrations` rebuilds the test schema and validates `listing_status`.
- `pnpm test:performance:startup` runs the focused Patch 17/18 regression set.

## Staging measurements still required

Static and integration tests cannot replace runtime measurement. Before production promotion capture:

- Web request count and transferred bytes for Home, Browse, Listing Detail, Messages, Notifications, Cart, and Account.
- Mobile request count during cold start, tab switching, background/foreground, refresh, and fast infinite scrolling.
- p50/p95 API latency for list, detail, auth bootstrap, conversation list, unread count, and cart summary.
- Duplicate request signatures by method + normalized path + query + 2-second window.
- Socket listener count after ten route/tab transitions.
- JS heap/image memory on Galaxy S22 after browsing at least 200 listings.

## Release position

Automatic GitHub Actions may remain paused while quota is constrained. The underlying fresh migration and clean mobile dependency-build problems are fixed in source and must be validated once with manual `workflow_dispatch` before automatic push/PR triggers are restored.
