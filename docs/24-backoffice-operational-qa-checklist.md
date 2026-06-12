# Backoffice Operational QA Checklist

This document is the final validation checklist before freezing the BabyLoop backoffice and moving product work back to the public web app.

## Freeze definition

Backoffice can be frozen when:

- Core admin workflows work.
- Backoffice auth is cookie-based.
- Access tokens are not stored in localStorage/sessionStorage.
- CSRF protects cookie-authenticated unsafe mutations.
- Minimal server-side RBAC exists.
- Sensitive data is hidden by default.
- Sensitive access is explicit and reason-required.
- Enforcement and sensitive workflows are audited.
- AI summary and AI Ops do not expose raw payloads.
- Typecheck, targeted tests, grep checks, and manual UI checks pass.

## Deferred items

These do not block freeze:

- Assignment / SLA workflows
- Appeals / export
- Advanced team workflows
- Advanced E2E/component tests
- Full legal archive
- Direct message action form
- Full AI cost dashboard
- Advanced alerting
- Full enterprise RBAC management UI
- Admin user management UI
- Audit export
- Case ownership / queue assignment
- Moderator performance metrics

## 1. Repository sanity

Run before freeze:

    cd /Users/erhan-pc-mac/Desktop/babyloop

    git status --short
    git log --oneline -8
    git diff --stat
    git diff --check

Expected:

- Working tree is clean except this checklist patch.
- Recent commits include CSRF enforcement and minimal RBAC foundation.
- No whitespace errors.

## 2. Typecheck

Run:

    pnpm --filter @babyloop/database typecheck
    pnpm --filter @babyloop/api typecheck
    pnpm --filter @babyloop/backoffice typecheck

Expected:

- All pass.

## 3. Targeted tests

Run:

    TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm --filter @babyloop/api exec vitest run test/auth.integration.test.ts --config vitest.config.ts

    TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm --filter @babyloop/api exec vitest run test/admin-moderation.integration.test.ts --config vitest.config.ts

    pnpm --filter @babyloop/api exec vitest run test/backoffice-csrf.test.ts --config vitest.config.ts

    pnpm --filter @babyloop/api exec vitest run test/admin-dashboard.schemas.test.ts --config vitest.config.ts
    pnpm --filter @babyloop/api exec vitest run test/admin-ai-ops.schemas.test.ts --config vitest.config.ts
    pnpm --filter @babyloop/api exec vitest run test/admin-conversations.schemas.test.ts --config vitest.config.ts
    pnpm --filter @babyloop/api exec vitest run test/admin-profiles.schemas.test.ts --config vitest.config.ts

Expected:

- All targeted tests pass.
- Integration tests must be run with TEST_DATABASE_URL.

## 4. CSRF checks

Validate:

- Cookie-authenticated admin mutation without CSRF token is rejected.
- Cookie-authenticated logout without CSRF token is rejected.
- Backoffice client sends x-babyloop-csrf-token on unsafe methods.
- Login and refresh fetch CSRF token.
- Bearer-token clients are not broken.

## 5. RBAC checks

Validate permissions:

- dashboard_view
- moderation_view
- moderation_enforce
- sensitive_access
- listing_review
- profile_view
- profile_enforce
- conversation_view
- audit_view
- ai_ops_view
- ai_generate

Expected:

- Admin has all permissions.
- Moderator has operational moderation permissions but not sensitive access unless explicitly configured.
- Support is view-only.
- Non-backoffice users cannot access admin routes.
- Permission failures return generic 403.
- 403 responses do not leak internal permission details.

Critical routes:

- Sensitive access requires sensitive_access.
- Profile enforcement requires profile_enforce.
- Listing/image actions require listing_review.
- AI summary generation requires ai_generate.
- AI Ops requires ai_ops_view.
- Audit browser requires audit_view.

## 6. Privacy and token grep

Run token grep:

    grep -R "localStorage\|sessionStorage\|BACKOFFICE_AUTH_TOKEN_STORAGE_KEY\|setAuthToken\|getAuthToken\|clearAuthToken\|Authorization:.*Bearer" -n apps/backoffice/src | sort

Run privacy grep:

    grep -R "seller.email\|profile.email\|user.email\|phone\|message.body\|reporter.email\|refreshToken\|accessToken\|passwordHash\|console.log\|localStorage\|sessionStorage\|document.cookie\|rawReason\|reasonText" -n apps/api/src apps/backoffice/src | sort

Known acceptable hits:

- Auth routes/services may contain refreshToken, accessToken, and passwordHash.
- Google OAuth service may contain token terms.
- redaction.service.ts may contain REDACTED_PHONE.
- Sensitive access code may reference raw sensitive fields only inside reason-required sensitive access flow.
- UI copy may mention that email, phone, or raw message body is not shown.
- message.bodyPreview is allowed if it is safe/redacted.

Blockers:

- Admin DTO exposes raw user.email, profile.email, phone, raw message body, raw AI payload, or reporter identity by default.
- Backoffice stores access token in localStorage/sessionStorage.
- Backoffice reads access/refresh token through document.cookie.
- Cookie-authenticated admin mutation succeeds without CSRF.
- AI Ops or AI summary UI exposes raw input/output/prompt/message body.

## 7. Manual UI checklist

Verify manually:

- Login works.
- Refresh keeps session usable.
- Logout works.
- Dashboard loads aggregate metrics only.
- Moderation list/detail/timeline works.
- Sensitive access request/deny/grant works and is audited.
- Listing archive/restore works.
- Image approve/reject works.
- Profile directory/detail/enforcement works.
- Conversation list/detail works with redacted message preview.
- AI summary generate/history works with safe output.
- AI Ops summary/runs work without raw payloads.
- Audit browser works with safe metadata.

## 8. OpenAI smoke test

Not required for UI freeze, but required before claiming OpenAI provider is production-ready.

Validate with:

- AI_MODERATION_SUMMARY_PROVIDER=openai
- OPENAI_API_KEY
- OPENAI_MODERATION_SUMMARY_MODEL
- OPENAI_RESPONSES_ENDPOINT

Expected:

- AI summary generation succeeds.
- AI model run is logged.
- No raw input/output/prompt/message body appears in API response or UI.
- Provider errors are safe.
- Rate limiting still works.

## 9. Freeze decision

Freeze is allowed only when:

- Typecheck passes.
- Targeted tests pass.
- Token grep has no blocker.
- Privacy grep has no blocker.
- Manual UI pass is completed.
- RBAC smoke test is completed.
- CSRF validation is completed.
- Any blocker is fixed before web work starts.

## 10. Web handoff order

After freeze, continue public web product work in this order:

1. Product event logging
2. Pagination / sort / filters
3. Category-first discovery
4. Category landing pages
5. Search suggestions
6. Recently viewed listings
7. Recommendation foundation
8. Child profile MVP
9. Lifecycle recommendation
10. AI-assisted listing draft / listing suggestion
11. Price suggestion / similar listings signal
12. Web UI/UX revision
13. Full flow audit
14. DevOps / production hardening
15. Mobile
