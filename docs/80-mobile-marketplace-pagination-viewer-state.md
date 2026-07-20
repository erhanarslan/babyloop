# Mobile marketplace pagination and viewer-state completion

## Scope

This release closes the remaining mobile marketplace request and rendering gaps identified after the runtime orchestration work.

## Browse runtime

- The discover feed uses a `FlatList`-backed virtualized screen rather than rendering every listing through `ScrollView + map`.
- Public listing pagination metadata is preserved by the mobile API client.
- The first page and subsequent pages use an explicit offset/limit contract.
- Pull-to-refresh replaces the current feed.
- End-of-list loading appends deduplicated results.
- A new listing request aborts the previous HTTP request so stale searches do not continue consuming network and parsing resources.
- Rendering is bounded with controlled initial render, batch size, window size, and Android clipping.

## Listing viewer state

The public listing detail response now contains privacy-safe viewer state:

- `isOwner`
- `isFavorited`

The route remains public. When a valid authenticated session is present, the response derives viewer state without exposing the viewer identity. The mobile listing detail screen no longer downloads the user's complete favorites collection to determine one listing's state.

## Notification request reduction

`GET /notifications` returns both the notification collection and its unread count. The mobile screen no longer performs a second unread-count request during initial loading. Notification preferences load independently and do not block the primary notification list.

## Safety and privacy boundaries

- Viewer state exposes booleans only.
- Favorite profile IDs, email addresses, tokens, and session data are not returned.
- Aborted requests do not surface as user-visible errors.
- Existing mutation and authentication boundaries remain unchanged.
