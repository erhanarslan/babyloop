import { createApp } from "../app.js";
import { processDueChildReminderNotifications } from "../services/child-reminder-scheduler.service.js";

async function main(): Promise<void> {
  const app = createApp();
  const dryRun = process.env.CHILD_REMINDER_PROCESSOR_DRY_RUN !== "false";
  const limit = readPositiveInteger("CHILD_REMINDER_PROCESSOR_LIMIT", 50);

  await app.ready();

  try {
    const summary = await processDueChildReminderNotifications(app, {
      dryRun,
      limit
    });

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Child reminder processor failed.");
  process.exitCode = 1;
});
