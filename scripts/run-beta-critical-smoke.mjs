import { spawnSync } from "node:child_process";

const skipTypecheck = process.env.BABYLOOP_BETA_SMOKE_SKIP_TYPECHECK === "1";

const steps = [
  { label: "Beta critical smoke boundary", command: "pnpm", args: ["security:beta-critical-smoke"] },
  { label: "API security aggregate", command: "pnpm", args: ["test:api:security"] },
  { label: "Assistant safety guard", command: "pnpm", args: ["security:assistant-safety-guard"] },
  { label: "Storage ops preview guard", command: "pnpm", args: ["security:storage-ops-preview"] },
  { label: "Mobile real-device S22 QA guard", command: "pnpm", args: ["qa:mobile:s22"] },
  { label: "Notification n8n readiness guard", command: "pnpm", args: ["security:notification-n8n-readiness"] },
  { label: "Notification push readiness guard", command: "pnpm", args: ["security:notification-push-readiness"] },
  { label: "Notification delivery transitions guard", command: "pnpm", args: ["security:notification-delivery-transitions"] },
  { label: "Notification ops preview guard", command: "pnpm", args: ["security:notification-ops-preview"] },
  { label: "Notification delivery log guard", command: "pnpm", args: ["security:notification-delivery-log"] },
  { label: "Auth secret leak guard", command: "pnpm", args: ["security:auth-leaks"] },
  { label: "Release artifact guard", command: "pnpm", args: ["release:artifacts"] },
  { label: "Deployment readiness guard", command: "pnpm", args: ["security:deployment-readiness"] },
  ...(skipTypecheck
    ? []
    : [
        { label: "API typecheck", command: "pnpm", args: ["--filter", "@babyloop/api", "typecheck"] },
        { label: "Backoffice typecheck", command: "pnpm", args: ["--filter", "@babyloop/backoffice", "typecheck"] },
        { label: "Web typecheck", command: "pnpm", args: ["--filter", "@babyloop/web", "typecheck"] },
        { label: "Mobile typecheck", command: "pnpm", args: ["--filter", "@babyloop/mobile", "typecheck"] }
      ])
];

const startedAt = Date.now();

for (const [index, step] of steps.entries()) {
  const prefix = `[${index + 1}/${steps.length}]`;
  console.log(`${prefix} ${step.label}`);
  console.log(`${prefix} $ ${step.command} ${step.args.join(" ")}`);

  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      BABYLOOP_BETA_CRITICAL_SMOKE: "1"
    }
  });

  if (result.error) {
    console.error(`${prefix} ${step.label} failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${prefix} ${step.label} failed with exit code ${result.status ?? "unknown"}.`);
    process.exit(result.status ?? 1);
  }
}

const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`Beta critical smoke passed in ${durationSeconds}s.`);
console.log("Manual physical Galaxy S22 QA evidence must still be recorded before beta release.");
