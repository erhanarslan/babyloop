import type { Database } from "@babyloop/database";
import type { FastifyRequest } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type { RealtimeHub } from "../realtime/socket.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<CurrentUser | null>;
    db: Database;
    realtime?: RealtimeHub;
  }

  interface FastifyRequest {
    currentUser: CurrentUser | null;
  }
}
