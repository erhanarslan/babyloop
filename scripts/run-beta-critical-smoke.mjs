import { spawnSync } from "node:child_process";

const skipTypecheck = process.env.BABYLOOP_BETA_SMOKE_SKIP_TYPECHECK === "1";

const steps = [
  { label: "Beta critical smoke boundary", command: "pnpm", args: ["security:beta-critical-smoke"] },
  { label: "P0 release surface smoke inventory guard", command: "pnpm", args: ["security:p0-release-surface-smoke-inventory"] },
  { label: "Core safety child foundation guard", command: "pnpm", args: ["security:core-safety-child-foundation"] },
  { label: "Notification marketplace core guard", command: "pnpm", args: ["security:notification-marketplace-core"] },
  { label: "Marketplace web mobile completion guard", command: "pnpm", args: ["security:marketplace-web-mobile-completion"] },
  { label: "API security aggregate", command: "pnpm", args: ["test:api:security"] },
  { label: "Assistant safety guard", command: "pnpm", args: ["security:assistant-safety-guard"] },
  { label: "Storage ops preview guard", command: "pnpm", args: ["security:storage-ops-preview"] },
  { label: "Mobile P0 release gate boundary", command: "pnpm", args: ["security:mobile-p0-gate"] },
  { label: "Mobile P0 release gate", command: "pnpm", args: ["release:mobile:p0"] },
  { label: "Mobile real-device S22 QA guard", command: "pnpm", args: ["qa:mobile:s22"] },
  { label: "Mobile OTP/MFA hardening guard", command: "pnpm", args: ["security:mobile-otp-mfa-hardening"] },
  { label: "Child notebook reminder hardening guard", command: "pnpm", args: ["security:child-notebook-reminder-hardening"] },
  { label: "Child reminder API schedule guard", command: "pnpm", args: ["security:child-reminder-api-schedule"] },
  { label: "Notification preference QA guard", command: "pnpm", args: ["security:notification-preference-qa"] },
  { label: "Notification n8n readiness guard", command: "pnpm", args: ["security:notification-n8n-readiness"] },
  { label: "Notification push readiness guard", command: "pnpm", args: ["security:notification-push-readiness"] },
  { label: "Notification sender provider design guard", command: "pnpm", args: ["security:notification-sender-provider-design"] },
  { label: "Notification observability taxonomy guard", command: "pnpm", args: ["security:notification-observability-taxonomy"] },
  { label: "Notification consent preference guard", command: "pnpm", args: ["security:notification-consent-preference"] },
  { label: "Notification delivery transitions guard", command: "pnpm", args: ["security:notification-delivery-transitions"] },
  { label: "Notification ops preview guard", command: "pnpm", args: ["security:notification-ops-preview"] },
  { label: "Notification delivery log guard", command: "pnpm", args: ["security:notification-delivery-log"] },
  { label: "Notification provider execution guard", command: "pnpm", args: ["security:notification-provider-execution"] },
  { label: "Notification worker atomic claim guard", command: "pnpm", args: ["security:notification-worker-atomic-claim"] },
  { label: "Runtime readiness and observability guard", command: "pnpm", args: ["security:runtime-readiness-observability"] },
  { label: "Auth secret leak guard", command: "pnpm", args: ["security:auth-leaks"] },
  { label: "Public auth cookie migration guard", command: "pnpm", args: ["security:public-auth-cookie-migration"] },
  { label: "Release artifact guard", command: "pnpm", args: ["release:artifacts"] },
  { label: "Deployment readiness guard", command: "pnpm", args: ["security:deployment-readiness"] },
  ...(skipTypecheck
    ? []
    : [
        { label: "API typecheck", command: "pnpm", args: ["--filter", "@babyloop/api", "typecheck"] },
        { label: "Backoffice typecheck", command: "pnpm", args: ["--filter", "@babyloop/backoffice", "typecheck"] },
        { label: "Web typecheck", command: "pnpm", args: ["--filter", "@babyloop/web", "typecheck"] },
        { label: "Mobile typecheck", command: "pnpm", args: ["--filter", "@babyloop/mobile", "typecheck"] }
      ]),
  { label: "Image upload/review storage boundary guard", command: "pnpm", args: ["security:image-upload-review-storage"] },
  { label: "Messaging safety full-flow boundary guard", command: "pnpm", args: ["security:messaging-safety-full-flow"] },
  { label: "Notification consistency audit boundary guard", command: "pnpm", args: ["security:notification-consistency-audit"] },
  { label: "Public safety abuse-flow boundary guard", command: "pnpm", args: ["security:public-safety-abuse-flow"] },
  { label: "Auth/session/CSRF/realtime/read-state boundary guard", command: "pnpm", args: ["security:auth-session-realtime-readstate"] },
  { label: "Mobile messaging/realtime parity boundary guard", command: "pnpm", args: ["security:mobile-messaging-realtime-parity"] },
  { label: "Mobile OTP/MFA session regression boundary guard", command: "pnpm", args: ["security:mobile-auth-otp-session-regression"] },
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
