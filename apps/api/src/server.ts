import { createApp } from "./app.js";
import { readApiRuntimeConfig } from "./config/env.js";

const app = createApp();
const config = readApiRuntimeConfig();

app.listen(config).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
