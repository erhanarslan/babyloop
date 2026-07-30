import assert from "node:assert/strict";
import test from "node:test";

import {
  assertViewerOperatorApplyGuard,
  assertViewerRoleTransition,
  maskOperatorEmail,
} from "../dist/backoffice-viewer-role.js";

test("assigns only a normal user and supports idempotent viewer assignment", () => {
  assert.equal(assertViewerRoleTransition("user", "assign"), "backoffice_viewer");
  assert.equal(assertViewerRoleTransition("backoffice_viewer", "assign"), "backoffice_viewer");
});

test("never overwrites privileged roles", () => {
  for (const role of ["admin", "moderator", "support"]) {
    assert.throws(() => assertViewerRoleTransition(role, "assign"));
  }
});

test("revokes only a viewer back to a normal user", () => {
  assert.equal(assertViewerRoleTransition("backoffice_viewer", "revoke"), "user");
  assert.throws(() => assertViewerRoleTransition("user", "revoke"));
});

test("masks operator email output", () => {
  const masked = maskOperatorEmail("person@example.com");
  assert.equal(masked, "pe****@example.com");
  assert.doesNotMatch(masked, /person@/u);
});

test("production apply requires the exact confirmation token", () => {
  assert.throws(() => assertViewerOperatorApplyGuard({
    apply: true,
    confirmation: undefined,
    databaseUrl: undefined,
    environment: "production",
  }));
  assert.doesNotThrow(() => assertViewerOperatorApplyGuard({
    apply: true,
    confirmation: "ASSIGN_BACKOFFICE_VIEWER_PRODUCTION",
    databaseUrl: undefined,
    environment: "production",
  }));
});

test("an omitted environment cannot disguise a remote apply as local", () => {
  assert.throws(() => assertViewerOperatorApplyGuard({
    apply: true,
    confirmation: undefined,
    databaseUrl: "postgresql://operator:secret@db.example.test/babyloop-production",
    environment: "local",
  }));
  assert.doesNotThrow(() => assertViewerOperatorApplyGuard({
    apply: true,
    confirmation: undefined,
    databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
    environment: "local",
  }));
});
