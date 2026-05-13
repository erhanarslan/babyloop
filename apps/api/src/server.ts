import Fastify from "fastify";

export function buildServer() {
  const server = Fastify({
    logger: true
  });

  server.get("/health", async () => ({
    ok: true,
    service: "babyloop-api" as const
  }));

  return server;
}

const server = buildServer();
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

server.listen({ port, host }).catch((error) => {
  server.log.error(error);
  process.exit(1);
});
