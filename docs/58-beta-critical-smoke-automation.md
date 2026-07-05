# Full beta critical smoke automation

The full beta critical smoke automation is the release gate command for BabyLoop beta readiness. It collects the most important automated guards and typechecks into a single command:

```bash
pnpm beta:critical-smoke
```

Boundary/config guard:

```bash
pnpm security:beta-critical-smoke
```

## What the command runs

The smoke runner executes these gates in sequence:

- `pnpm security:beta-critical-smoke`
- `pnpm test:api:security`
- `pnpm security:assistant-safety-guard`
- `pnpm security:storage-ops-preview`
- `pnpm qa:mobile:s22`
- `pnpm security:notification-n8n-readiness`
- `pnpm security:notification-push-readiness`
- `pnpm security:notification-delivery-transitions`
- `pnpm security:notification-ops-preview`
- `pnpm security:notification-delivery-log`
- `pnpm security:auth-leaks`
- `pnpm release:artifacts`
- `pnpm --filter @babyloop/api typecheck`
- `pnpm --filter @babyloop/backoffice typecheck`
- `pnpm --filter @babyloop/web typecheck`
- `pnpm --filter @babyloop/mobile typecheck`

If memory is tight on the M1 8GB laptop, typecheck-only steps can be skipped temporarily with:

```bash
BABYLOOP_BETA_SMOKE_SKIP_TYPECHECK=1 pnpm beta:critical-smoke
```

That skip mode is only for local iteration. It is not acceptable for a beta release decision.

## Explicit non-goals

This automation does not replace manual physical Galaxy S22 QA evidence.

It also does not enable push sender, does not enable n8n workflow, does not enable S3/R2 external storage, and does not enable autonomous RAG answers. It is a release gate, not a feature flag.

## Required evidence before beta

Before a beta release decision, keep the following evidence in the local release notes or issue tracker:

- full `pnpm beta:critical-smoke` output
- physical Galaxy S22 QA pass/fail result
- known blocked items
- screenshots or recordings for failures
- release decision: go / no-go

## Coverage

The command intentionally covers:

- assistant safety guard and hallucination/grounding boundary
- storage ops preview and external storage disabled boundary
- mobile real-device S22 QA checklist presence
- notification readiness: n8n disabled, push disabled, delivery transitions guarded, ops preview guarded, delivery log guarded
- auth-leak and release-artifact guards
- API/backoffice/web/mobile typechecks
