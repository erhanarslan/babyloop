# Mobile OTP/MFA hardening gate

Mobile OTP/MFA hardening defines the release boundary for BabyLoop mobile authentication continuation flows. This package is readiness-only and does not change runtime auth behavior.

Guard command:

```bash
pnpm security:mobile-otp-mfa-hardening
```

This guard is wired into:

```bash
pnpm beta:critical-smoke
```

## Current status

Current status: readiness-only.

This gate does not enable SMS OTP, does not enable authenticator MFA, does not enable push security notification, does not change runtime auth behavior, and does not change provider configuration.

Manual Galaxy S22 QA evidence is required before beta release.

## Required flows

Mobile OTP/MFA hardening must cover:

- login without MFA
- login with MFA required
- valid OTP verification
- invalid OTP error
- expired OTP error
- rate limit / brute-force error
- resend OTP
- network failure recovery
- session refresh after verify
- logout cleanup
- protected route return after successful MFA
- back navigation from OTP screen
- app background/foreground during OTP flow
- real Galaxy S22 QA

## Storage and privacy boundary

Mobile auth must require SecureStore or equivalent secure device storage for sensitive session material. OTP/token/cookie/password values must not be logged.

Do not store tokens in AsyncStorage, localStorage, sessionStorage, debug logs, screenshots, analytics dimensions, crash reports, or notification payloads.

## Security boundary

Before runtime OTP/MFA changes:

- rate limit must be enforced
- resend cooldown must exist
- expired code path must be handled
- invalid code path must be handled
- blocked account path must be handled
- session refresh must run after verification
- logout cleanup must clear sensitive state
- protected route return must be tested
- auth secret leak guard must pass
- beta critical smoke must pass

## Release boundary

A beta release cannot pass mobile OTP/MFA if:

- OTP required response is not handled on mobile
- successful verification does not refresh session state
- logout leaves sensitive state behind
- rate limit is not visible to the user
- invalid/expired code states are unclear
- Galaxy S22 manual QA evidence is missing

Exact guard wording: manual Galaxy S22 QA evidence is required before beta release.
