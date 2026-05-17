BabyLoop Architecture Decisions

## Purpose

This document records architecture decisions that guide BabyLoop development.

These decisions exist to prevent uncontrolled feature growth, inconsistent contracts, and repeated refactors.

---

## AD-001: Web Must Not Access Database Directly

### Decision

The Next.js web app must not import or use `packages/database` directly.

Allowed flow:

```text
apps/web -> apps/api -> packages/database