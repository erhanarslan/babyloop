import { createApp } from "./app.js";
import { readApiRuntimeConfig } from "./config/env.js";
import { createRuntimeObservability } from "./services/runtime-observability.service.js";

const config = readApiRuntimeConfig();
const observability = createRuntimeObservability();
const app = createApp({ config, observability });
let fatalShutdownStarted = false;

process.once("uncaughtException", (error) => {
  void reportFatalAndExit(error, "uncaught_exception");
});

process.once("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error("Unhandled promise rejection.");
  void reportFatalAndExit(error, "unhandled_rejection");
});

app.listen({
  host: config.host,
  port: config.port
}).catch(async (error) => {
  app.log.error(error);
  await observability.captureException(error, {
    event: "api_startup_failed"
  });
  process.exit(1);
});

async function reportFatalAndExit(error: Error, event: string): Promise<void> {
  if (fatalShutdownStarted) {
    return;
  }

  fatalShutdownStarted = true;
  app.log.fatal({ error, event }, "Fatal runtime error.");

  await Promise.allSettled([
    observability.captureException(error, { event }),
    app.close()
  ]);

  process.exit(1);
}
