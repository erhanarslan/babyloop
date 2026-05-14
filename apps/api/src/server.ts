import { createApp } from "./app.js";
import { readApiRuntimeConfig } from "./config/env.js";

const config = readApiRuntimeConfig();
const app = createApp({ config });

app.listen({
  host: config.host,
  port: config.port
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
