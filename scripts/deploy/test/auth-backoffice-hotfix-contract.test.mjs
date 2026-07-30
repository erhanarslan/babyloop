import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("auth rate limiting runs before validation and exposes cooldown headers", async () => {
  const source = await readFile("apps/api/src/app.ts", "utf8");

  assert.match(source, /hook:\s*"preValidation"/u);
  for (const header of ["Retry-After", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"]) {
    assert.ok(source.includes(header), header);
  }
});

test("production acceptance probes readonly docs and excludes internal metrics", async () => {
  const source = await readFile("scripts/deploy/post-deploy-smoke.mjs", "utf8");

  assert.ok(source.includes('name: "api-docs"'));
  assert.ok(source.includes('url: `${apiUrl}/docs/`'));
  assert.ok(source.includes('name: "api-openapi"'));
  assert.ok(source.includes('!Object.hasOwn(body.paths, "/internal/metrics")'));
});

test("API and backoffice image packaging retain migrations and metadata routes", async () => {
  const dockerfile = await readFile("deploy/docker/Dockerfile", "utf8");

  assert.ok(dockerfile.includes("cp -R packages/database/drizzle/. /out/api/migrations/"));
  assert.ok(dockerfile.includes("/workspace/apps/backoffice/.next/standalone"));
  assert.ok(dockerfile.includes("/workspace/apps/backoffice/.next/static"));
});

test("the process-local auth limiter remains bounded to one Cloud Run instance", async () => {
  const contract = JSON.parse(await readFile("deploy/gcp/cloud-run.contract.json", "utf8"));

  assert.equal(contract.services.api.maxInstances, 1);
});
