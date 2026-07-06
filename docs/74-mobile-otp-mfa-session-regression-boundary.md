# Mobile OTP/MFA session regression boundary

Mobile OTP/MFA session regression audit is the P0 release boundary for mobile login, mfa_required screen-state, OTP verification, refresh/session restore, logout cleanup, and secure token storage.

Run:

pnpm security:mobile-auth-otp-session-regression

This audit verifies:

- API login/logout/refresh/auth-me coverage remains visible.
- API mfa_required and OTP challenge/verification behavior remains covered.
- API session negative cases remain covered.
- Mobile login and mfa_required screen-state remain covered.
- Mobile OTP submit/verify behavior remains covered.
- Mobile refresh/session restore behavior remains covered.
- Mobile logout cleanup behavior remains covered.
- Mobile auth error/loading/retry states remain covered.
- Mobile auth storage uses SecureStore and does not fall back to AsyncStorage/localStorage/sessionStorage for token persistence.
- Mobile P0 release gate runs this audit.
- Beta critical smoke runs this audit.

No-leak guarantees:

- Mobile OTP/MFA/session surfaces do not expose accessToken.
- Mobile OTP/MFA/session surfaces do not expose refreshToken.
- Mobile OTP/MFA/session surfaces do not expose passwordHash.
- Mobile OTP/MFA/session surfaces do not expose cookie.
- Mobile OTP/MFA/session surfaces do not expose authorization.

Release rule:

Mobile OTP/MFA and auth session behavior is P0. The app must not be considered beta-ready unless pnpm security:mobile-auth-otp-session-regression, pnpm security:mobile-auth, pnpm test:mobile:p0, and the API auth integration tests pass.

Real-device note:

This audit does not replace S22/Maestro real-device smoke. It keeps API/mobile session behavior release-blocked until the automated P0 gates pass; #137 real-device smoke remains a separate deferred validation item.

Mobile OTP/MFA session regression audit does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, and does not expose authorization in API, mobile, docs, logs, or storage surfaces.
