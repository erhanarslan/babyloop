# Web + Mobile Performance and API Traffic Audit

## Scope

This audit covers public discovery, listing pagination, page-open request topology, duplicate page requests, polling/timer lifetime, cancellation, and list response cost across web, mobile, and API.

## Fixed in this change

### Listing pagination

- Web browse and category pages render the first 20 listings on the server and append later pages in 20-item batches.
- A guarded `IntersectionObserver` drives automatic loading; an explicit “20 ilan daha göster” button remains as keyboard/accessibility and observer fallback.
- Mobile discover uses the same 20-item page size. A synchronous in-flight ref prevents repeated `onEndReached` events from starting the same offset twice.
- Both clients use API-provided `nextOffset`; appended pages are de-duplicated by listing ID.
- Home discovery is aligned to 20-item initial and appended pages and no longer stops automatically at 50 items.

### API query cost and ordering

- The first page keeps an exact `total` count.
- Later pages send `includeTotal=false`; the API fetches `limit + 1` rows to determine `hasNextPage` without another `COUNT(*)`.
- Pagination now returns `nextOffset`.
- Every sort has an ID tie-breaker, preventing unstable page boundaries when timestamps or prices match.

### Duplicate calls

- Category metadata and page rendering share a request-scoped cached category request instead of calling `/categories` twice.
- Infinite-scroll clients never refetch page zero after hydration.
- A synchronous in-flight offset guard prevents observer/state timing from duplicating later-page calls.

### Polling and lifetime

- Web “my listings” publication refresh no longer uses a permanent 7-second interval.
- Refresh pauses while the page is hidden or unfocused.
- Failures back off through 7/12/20/30 seconds and focus/visibility return triggers an immediate refresh.
- Browse and home list requests use `AbortController` and are cancelled during filter/location replacement or unmount.

## Request topology after the change

| Surface | Initial requests | Later-page requests | Notes |
|---|---:|---:|---|
| Web `/browse` | categories + listings + optional suggestions | listings only | 20 per page; later pages skip count |
| Web category | cached categories + listings + optional suggestions | listings only | metadata/page categories de-duplicated |
| Web home feed | listings + authenticated favorites state | listings only | 20 per page; no artificial 50-item stop |
| Mobile discover | listings + categories | listings only | 20 per page; guarded `onEndReached` |
| Web my listings | one initial request | conditional publication refresh | visibility/focus aware bounded backoff |

## Timer inventory

Intentional timers remain for analytics engagement heartbeats, active image rotation, message read debounce, and push retry. They are lifecycle-bound or visibility/AppState-gated. Publication polling was the only unconditional data interval found on a listing page and has been replaced.

## Follow-up runtime measurement

Static contracts prevent known regressions, but staging should still record:

- request count per route/screen open,
- duplicate URL + method calls inside a 500 ms window,
- response bytes and p50/p95 latency for listing pages,
- SQL duration for list/count/image/favorite queries,
- React render counts for listing grids and cards,
- memory and dropped-frame behavior on Galaxy S22 after 200+ loaded listings.

These measurements belong in the staging/real-device phase; they should not be guessed from unit tests.
