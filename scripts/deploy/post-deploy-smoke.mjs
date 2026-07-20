#!/usr/bin/env node
import { assertEnvironment, loadEnvFile, required } from "./deployment-lib.mjs";

const envFile = required(process.env.DEPLOY_ENV_FILE, "DEPLOY_ENV_FILE");
const { values } = await loadEnvFile(envFile);
const environment = assertEnvironment(process.env.DEPLOY_ENVIRONMENT || values.DEPLOY_ENVIRONMENT);
const apiUrl = stripTrailingSlash(process.env.DEPLOY_API_URL || values.NEXT_PUBLIC_API_BASE_URL);
const webUrl = stripTrailingSlash(process.env.DEPLOY_WEB_URL || values.NEXT_PUBLIC_SITE_URL);
const backofficeUrl = stripTrailingSlash(process.env.DEPLOY_BACKOFFICE_URL || values.NEXT_PUBLIC_BACKOFFICE_BASE_URL);
const metricsToken = process.env.OBSERVABILITY_METRICS_TOKEN || values.OBSERVABILITY_METRICS_TOKEN;
const attempts = readInteger("DEPLOY_SMOKE_ATTEMPTS", 18, 1, 60);
const delayMs = readInteger("DEPLOY_SMOKE_DELAY_MS", 5000, 500, 30000);
const timeoutMs = readInteger("DEPLOY_SMOKE_TIMEOUT_MS", 6000, 500, 20000);

for (const [name, value] of [["api", apiUrl], ["web", webUrl], ["backoffice", backofficeUrl]]) {
  if (!value || !value.startsWith("https://")) throw new Error(`${name} smoke URL must use HTTPS.`);
}

await waitFor("api-liveness", `${apiUrl}/health/live`, { attempts, delayMs, timeoutMs, validate: (body) => body?.live === true });
await waitFor("api-readiness", `${apiUrl}/health/ready`, { attempts, delayMs, timeoutMs, validate: (body) => body?.ready === true });
await waitFor("web", webUrl, { attempts, delayMs, timeoutMs, parseJson: false });
await waitFor("backoffice", backofficeUrl, { attempts, delayMs, timeoutMs, parseJson: false });

if (metricsToken) {
  const metrics = await request(`${apiUrl}/internal/metrics`, {
    headers: { authorization: `Bearer ${metricsToken}` },
    timeoutMs,
    parseJson: false
  });
  if (!metrics.text.includes("babyloop_")) throw new Error("Metrics endpoint returned no BabyLoop metrics.");
}

process.stdout.write(`${JSON.stringify({
  environment,
  ok: true,
  checkedAt: new Date().toISOString(),
  endpoints: { api: apiUrl, web: webUrl, backoffice: backofficeUrl },
  metricsChecked: Boolean(metricsToken)
}, null, 2)}\n`);

async function waitFor(name, url, options) {
  let lastError;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const result = await request(url, options);
      if (options.validate && !options.validate(result.body)) throw new Error(`${name} response contract failed.`);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < options.attempts) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }
  throw new Error(`${name} smoke failed after ${options.attempts} attempts: ${lastError instanceof Error ? lastError.message : "unknown"}`);
}

async function request(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, { headers: options.headers, redirect: "manual", signal: controller.signal });
    if (response.status >= 500 || response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error(`${url} returned ${response.status}.`);
    }
    const text = await response.text();
    let body = null;
    if (options.parseJson !== false) {
      try { body = JSON.parse(text); } catch { throw new Error(`${url} did not return JSON.`); }
    }
    return { body, status: response.status, text };
  } finally {
    clearTimeout(timer);
  }
}

function stripTrailingSlash(value) { return String(value || "").trim().replace(/\/+$/u, ""); }
function readInteger(name, fallback, minimum, maximum) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
