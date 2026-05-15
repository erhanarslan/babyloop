import type { Database } from "@babyloop/database";
import type { FastifyRequest } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<CurrentUser | null>;
    db: Database;
  }

  interface FastifyRequest {
    currentUser: CurrentUser | null;
  }
}
