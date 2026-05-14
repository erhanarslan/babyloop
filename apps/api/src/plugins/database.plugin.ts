import { createDatabaseClient, type DatabaseClient } from "@babyloop/database";
import type { FastifyInstance } from "fastify";

type DatabasePluginOptions = {
  databaseUrl: string;
};

export function registerDatabasePlugin(
  app: FastifyInstance,
  options: DatabasePluginOptions
): void {
  const client: DatabaseClient = createDatabaseClient({
    databaseUrl: options.databaseUrl
  });

  app.decorate("db", client.db);
  app.addHook("onClose", async () => {
    await client.close();
  });
}
