import { createApp } from "./app.js";
import { readApiRuntimeConfig } from "./config/env.js";
import { createRuntimeObservability } from "./services/runtime-observability.service.js";

const config = readApiRuntimeConfig();
const observability = createRuntimeObservability();
const app = createApp({ config, observability });
let shutdownStarted = false;

process.once("SIGTERM", () => {
  void shutdown({ event: "api_sigterm", exitCode: 0 });
});

process.once("SIGINT", () => {
  void shutdown({ event: "api_sigint", exitCode: 0 });
});

process.once("uncaughtException", (error) => {
  void shutdown({ error, event: "uncaught_exception", exitCode: 1 });
});

process.once("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error("Unhandled promise rejection.");
  void shutdown({ error, event: "unhandled_rejection", exitCode: 1 });
});

app.listen({
  host: config.host,
  port: config.port
}).catch((error) => {
  void shutdown({ error, event: "api_startup_failed", exitCode: 1 });
});

type ShutdownInput = {
  error?: Error;
  event: string;
  exitCode: 0 | 1;
};

async function shutdown(input: ShutdownInput): Promise<void> {
  if (shutdownStarted) return;
  shutdownStarted = true;

  if (input.error) {
    app.log.fatal({ error: input.error, event: input.event }, "API shutdown triggered by a fatal runtime error.");
  } else {
    app.log.info({ event: input.event }, "API graceful shutdown requested.");
  }

  const tasks: Promise<unknown>[] = [app.close()];
  if (input.error) {
    tasks.push(observability.captureException(input.error, { event: input.event }));
  }
  await Promise.allSettled(tasks);
  process.exit(input.exitCode);
}
