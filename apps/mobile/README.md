# BabyLoop Mobile

Expo / React Native mobile app for BabyLoop.

## Current scope

This package includes:

- app shell
- Expo Router stack
- API base URL config
- public listing browse fetch
- public listing detail fetch
- image URL resolver for API-hosted or absolute image URLs
- marketplace shell polish
- mobile auth API foundation
- login/register screens
- auth session context
- account auth state/logout surface

## Auth boundary

The current mobile auth foundation reuses the public web API contract:

- login/register return an access token
- API also sets public auth cookies
- mobile keeps the access token in memory and mirrors it to Expo SecureStore when SecureStore is available
- refresh tokens are not stored in AsyncStorage, localStorage, sessionStorage, or other JavaScript-readable mobile storage
- authenticated requests attach Bearer token when available
- mutation requests can attach public CSRF token
- refresh/logout use `credentials: include`

Do not store access tokens or refresh tokens in plain AsyncStorage/localStorage/sessionStorage. Native persistent auth must use the SecureStore-backed token storage guarded by `pnpm security:mobile-auth`.
