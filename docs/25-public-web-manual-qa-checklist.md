# Public Web Manual QA Checklist

Status target: public web feature-complete and QA-ready.

## Validation commands

Run these before manual QA:

```bash
pnpm --filter @babyloop/web typecheck
pnpm --filter @babyloop/web build
./scripts/public-web-client-directive-audit.sh
./scripts/public-web-final-audit.sh
./scripts/public-web-copy-audit.sh
```

Expected:

- Typecheck passes.
- Next build passes.
- Client directive audit has no misplaced `"use client"` directives.
- Strict privacy grep is empty.
- Unexpected access token references are empty.
- Copy audit may list hardcoded strings; that is an i18n backlog item.

## Navigation and layout

- [ ] Header is readable on desktop.
- [ ] Header does not push page content sideways.
- [ ] Menu button is visible and does not overlap core CTAs badly.
- [ ] Drawer opens and closes.
- [ ] Drawer links navigate correctly.
- [ ] Drawer does not permanently shift the page layout.
- [ ] Mobile drawer fits within viewport.
- [ ] Backdrop closes the drawer.
- [ ] Authenticated and unauthenticated navigation states both remain usable.

## Auth and account

- [ ] Register page renders.
- [ ] Login page renders.
- [ ] Logout clears public session state.
- [ ] Forgot password page renders.
- [ ] Reset password page renders.
- [ ] Email verification page renders.
- [ ] Verification request page renders.
- [ ] Change password page renders for authenticated user.
- [ ] Protected pages redirect unauthenticated users correctly.
- [ ] No access token is stored in localStorage or sessionStorage.

## Browse and discovery

- [ ] `/browse` renders.
- [ ] Search query works.
- [ ] Category filter works.
- [ ] Listing type filter works.
- [ ] Condition filter works.
- [ ] Price filters work.
- [ ] Image-only filter works.
- [ ] Sort works.
- [ ] Pagination works.
- [ ] Saved search CTA is visible and clear.
- [ ] Browse discovery panel does not crowd mobile layout.

## Category and guides

- [ ] Category pages render.
- [ ] Parent guides index renders.
- [ ] Guide detail pages render.
- [ ] Guide CTAs link to browse, saved searches, and assistant.
- [ ] Guide copy stays within marketplace guidance, not medical advice.

## Listings and selling

- [ ] Listing detail renders.
- [ ] Listing image frame renders.
- [ ] Favorite button works.
- [ ] Message seller CTA works for allowed users.
- [ ] Report listing CTA is visible.
- [ ] Sell page renders.
- [ ] Sell form validation is clear.
- [ ] AI listing suggestion panel is review-only.
- [ ] AI price suggestion panel is review-only.
- [ ] Listing publish flow succeeds.
- [ ] My listings page renders.
- [ ] Listing management actions remain clear.

## Favorites, saved searches, and notifications

- [ ] Favorites page renders.
- [ ] Empty favorites state is clear.
- [ ] Saved searches page renders.
- [ ] Saved search deletion works.
- [ ] Notifications page renders.
- [ ] Unread count behavior is reasonable.
- [ ] Notification copy does not expose buyer identity unnecessarily.

## Messaging and safety

- [ ] Conversations page renders.
- [ ] Conversation detail renders.
- [ ] Sending a normal message works.
- [ ] Script-like or unsafe message guidance is visible.
- [ ] Message read state updates when opening a thread.
- [ ] Report message CTA is visible.
- [ ] Block profile CTA is visible where expected.
- [ ] No message body is logged or copied into analytics output.

## Assistant and personalization

- [ ] Assistant page renders.
- [ ] Quick prompts work.
- [ ] Assistant API response path works.
- [ ] Assistant fallback path works if API is unavailable.
- [ ] Assistant does not give medical, therapeutic, medication, or diet advice.
- [ ] Child profile page renders.
- [ ] Child profile uses age-band data, not exact birth dates.
- [ ] Home personalization feed renders for authenticated users.

## Mobile pass

Check at small width around 390px:

- [ ] Header remains usable.
- [ ] Drawer remains usable.
- [ ] Browse filters do not overflow.
- [ ] Listing cards do not overflow.
- [ ] Listing detail CTA area remains usable.
- [ ] Sell form fields remain readable.
- [ ] Assistant chat layout remains usable.
- [ ] Conversation thread remains usable.
- [ ] Account pages remain usable.

## Launch blockers

Treat these as blockers:

- Build failure.
- Misplaced `"use client"` directive.
- Runtime token leakage into persistent browser storage.
- Strict privacy grep finding sensitive fields in public runtime code.
- Broken auth login/logout/refresh loop.
- Broken listing create/detail flow.
- Broken messaging send/read flow.
- Navigation blocking access to core pages.
- Mobile layout horizontal overflow on core flows.
