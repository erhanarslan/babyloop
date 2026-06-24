# Mobile Scope Freeze

This document freezes the first BabyLoop mobile scope before creating the mobile app skeleton.

## Decision

BabyLoop mobile will start with an Expo / React Native / TypeScript app.

The first mobile release is not a full marketplace replacement. It is a focused MVP that proves the highest-value parent marketplace flows on mobile while reusing the existing API and product rules.

## Why Expo first

Expo is selected for the first mobile slice because it provides:

- faster app skeleton setup
- simpler local development
- easier image picker integration later
- OTA/update-friendly development path
- enough flexibility for a marketplace MVP

Bare React Native or native iOS/Android should be avoided at this stage because it would slow down beta velocity without solving a current blocker.

## First mobile MVP scope

### P0 mobile flows

1. App shell and navigation.
2. Login/register shell.
3. Browse listings.
4. Listing detail.
5. Favorite/unfavorite.
6. Basic account state.
7. Messaging list/detail minimal.
8. Safe logout.

### P1 mobile flows

1. Sell listing minimal form.
2. Image picker/upload.
3. My listings.
4. Listing status update.
5. Saved searches.
6. Notification preferences.
7. Child profile list and lifecycle suggestions.

### Deferred mobile flows

1. Payment / checkout.
2. Promoted listings.
3. Full backoffice mobile.
4. Full RAG admin tools.
5. n8n automation management.
6. Advanced seller analytics.
7. Native push notification delivery.
8. Deep offline mode.

## API reuse

The mobile app should reuse existing API routes instead of creating mobile-specific duplicate endpoints.

Expected initial API dependencies:

- POST /api/v1/auth/login
- POST /api/v1/auth/register
- POST /api/v1/auth/logout
- GET /api/v1/auth/me
- GET /api/v1/listings
- GET /api/v1/listings/:id
- favorites endpoints
- messaging endpoints
- upload endpoints later

If native cookie behavior becomes unreliable, mobile auth may need a dedicated secure-token client strategy. Tokens must use secure storage, not AsyncStorage.

## Security boundaries

Mobile must preserve existing product safety boundaries:

- no access token in plain AsyncStorage
- no refresh token in plain AsyncStorage
- no seller email/phone exposure
- no private child profile exposure
- no raw admin data
- no medical, therapy, diagnosis, medication, treatment, or diet-plan assistant behavior
- no unsafe HTML/script rendering in messages or listings
- report/block flows must remain available but not visually overexposed

## UX priorities

The mobile app must feel like a marketplace first.

Priority order:

1. Search and browse.
2. Listing image/detail quality.
3. Fast favorite/save behavior.
4. Safe messaging.
5. Simple selling flow.
6. Child-aware discovery later.

The first mobile UI should be clean and direct, not a dashboard-heavy experience.

## Technical baseline

Recommended initial stack:

- Expo
- React Native
- TypeScript
- Expo Router
- React Query or a lightweight fetch layer
- SecureStore for sensitive native auth state if needed
- shared API types copied or imported only where stable

Do not introduce Redux for the first mobile slice unless state complexity forces it. Server state should remain request/cache driven.

## App package location

Preferred monorepo location: apps/mobile

The mobile app should be added as a workspace package without disrupting existing API, web, and backoffice builds.

## First skeleton acceptance criteria

The skeleton is acceptable when:

- apps/mobile exists.
- TypeScript works.
- Expo starts locally.
- Basic tabs/stack navigation exists.
- API base URL config exists.
- Login screen placeholder exists.
- Browse screen placeholder exists.
- Listing detail placeholder exists.
- No secrets are committed.
- Existing web/api/backoffice typechecks are not broken.

## Release rule

Do not expand mobile scope until the skeleton runs and the first API-backed browse/detail flow works.
