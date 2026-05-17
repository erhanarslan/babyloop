# BabyLoop Stabilization Roadmap

## Purpose

BabyLoop has reached a point where continuing to add features without stabilization will create architectural drift.

This roadmap defines how the current gaps will be fixed step by step.

The goal is not to slow the project down. The goal is to prevent the project from becoming unmaintainable.

---

## Current Situation

BabyLoop currently has a working local full-stack foundation:

- PostgreSQL database
- Drizzle schema and migrations
- Fastify API
- Next.js web app
- Auth foundation
- Listings
- Favorites
- Mock AI listing suggestions
- Messaging backend foundation

However, several areas are not yet mature enough for continued large feature expansion:

- API contract naming is inconsistent in some routes
- Messaging uniqueness model is not aligned with product intent
- Test infrastructure is missing
- Auth is local-MVP level, not production-grade
- DB schema needs hardening before admin/mobile/AI expansion
- Web UI is functional but not polished
- Production readiness is low

---

## Stabilization Rule

Until this roadmap reaches the first stable checkpoint, do not add:

- admin panel
- mobile app
- real AI provider
- image upload pipeline
- payments
- notifications
- full UI redesign
- moderation queue
- realtime messaging
- background workers

The project must first stabilize the existing foundation.

---

# Phase 1: Contract Stabilization

## Problem

The project currently mixes `camelCase` and `snake_case` in public API request bodies.

Known issues:

- favorites API uses `listing_id`
- messaging API uses `listing_id`
- listing create API already uses `camelCase`

This creates inconsistent frontend/API contracts.

## Decision

Public API request/response keys must use `camelCase`.

Database table and column names remain `snake_case`.

## Required Changes

### Favorites

Current request body:

```json
{
  "listing_id": "..."
}