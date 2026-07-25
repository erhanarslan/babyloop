#!/usr/bin/env node
const environment = String(process.argv[2] || "").trim().toLowerCase();
if (!["staging", "production"].includes(environment)) {
  throw new Error("Smoke target must be staging or production.");
}
if (process.env.DEPLOY_ENVIRONMENT && process.env.DEPLOY_ENVIRONMENT !== environment) {
  throw new Error(`DEPLOY_ENVIRONMENT must equal ${environment}.`);
}
process.env.DEPLOY_ENVIRONMENT = environment;
await import("./post-deploy-smoke.mjs");
