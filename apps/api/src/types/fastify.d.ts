import type { Database } from "@babyloop/database";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}
