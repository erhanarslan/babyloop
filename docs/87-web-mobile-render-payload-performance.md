# Web and Mobile Render / Payload Performance

## Scope

This pass follows the request-lifecycle audit and focuses on render cost, image decoding, list virtualization, and public listing payload size.

## Public listing payload budget

`GET /api/v1/listings` accepts `imageLimit=1..3` and defaults to three preview images per listing. The detail endpoint remains unchanged and still returns the complete approved gallery.

Client policy:

- Mobile discovery: one image per listing.
- Web search suggestions and compact rotators: one image per listing.
- Web browse and home product grids: at most three preview images per listing.
- Listing detail: complete gallery.

This keeps the 20-item infinite-scroll contract while preventing list pages from downloading up to five image descriptors for every card when they cannot render them. The current database query is already bounded by the five-image listing policy; this pass reduces API serialization and client network/parse cost rather than claiming a per-listing SQL row-limit optimization.

## Category request policy

Categories are stable reference data:

- API response: `Cache-Control: public, max-age=300, stale-while-revalidate=3600`.
- Next.js server fetches: five-minute revalidation.
- Mobile: five-minute in-memory cache with a shared in-flight promise.

Browse, sell, and listing-edit screens therefore share one category request during normal navigation instead of issuing independent requests.

## Web render policy

- Listing images declare lazy/eager loading, async decoding, responsive `sizes`, and optional fetch priority.
- Visibility-aware rotators use one shared external-store listener instead of attaching a `visibilitychange` listener per component.
- Hover image rotation stops while the document is hidden.
- Listing metadata and page rendering share one request-scoped detail lookup instead of issuing the same API request twice.
- Sitemap category and listing reads use a five-minute revalidation window.
- The main listing image is eager/high priority; thumbnails and cards remain lazy.

## Mobile render policy

- Discovery cards are memoized and rendered through a stable `renderItem` callback.
- Discovery uses smaller FlatList batches and window size for Galaxy S22 memory pressure.
- Remote images disable Android fade animation, enable progressive rendering, and request resize-based decoding.
- The message thread uses a virtualized FlatList instead of rendering the full conversation inside a ScrollView.
- Message bubbles are memoized and keyed by message ID.

## Release checks

Run:

```bash
pnpm security:web-mobile-render-performance
pnpm test:performance:render
```

The full verification also runs API/web/mobile typechecks, targeted regressions, complete suites, and production builds.
