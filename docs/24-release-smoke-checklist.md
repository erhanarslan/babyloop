# BabyLoop Release Smoke Checklist

This checklist is the minimum release gate for the current local/staging demo flow.

## Default smoke

Run from the repository root:

    pnpm smoke:release

Default coverage:

- API typecheck
- Web typecheck
- Backoffice typecheck
- Mobile typecheck
- Mobile unit tests
- API targeted release tests
  - cart + mock iyzico checkout
  - assistant API
  - product event routes
  - product event schemas

## API full suite

Use before a release branch or large backend change:

    RUN_API_FULL=1 pnpm smoke:release

## Web E2E smoke

Prerequisite: API and web are already running.

    ./scripts/dev-clean-start.sh

Then in another terminal:

    RUN_WEB_E2E=1 pnpm smoke:release

This runs the web cart checkout Playwright smoke against the live local stack.

## Backoffice E2E smoke

Prerequisite: API and backoffice are already running.

    RUN_BACKOFFICE_E2E=1 pnpm smoke:release

## Mobile smoke

Manual mobile smoke is acceptable until Maestro device setup is stable.

Minimum manual checks:

1. Open the Expo app on Android.
2. Log in with a test user.
3. Open an active sale listing.
4. Add it to basket.
5. Open basket.
6. Complete mock iyzico checkout.
7. Confirm success state.
8. Confirm the listing cannot be bought again.
9. Open BabyLoop Assistant.
10. Ask a marketplace-safe question and confirm an answer is shown.

## Mobile Maestro smoke

Prerequisite: Android device/emulator must be visible through ADB.

    adb devices

Then:

    RUN_MOBILE_E2E=1 pnpm smoke:release

## Non-goals

This smoke is not a substitute for:

- full API suite
- full Playwright suite
- security testing
- load testing
- production deployment verification
- real payment provider verification
