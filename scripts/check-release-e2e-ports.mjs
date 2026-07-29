#!/usr/bin/env node
import net from "node:net";
import { pathToFileURL } from "node:url";

const LOOPBACK_HOST = "127.0.0.1";

export async function assertReleaseE2EPortsAvailable(
  rawPorts,
  { openPort = listenOnPort } = {},
) {
  const ports = rawPorts.map(parsePort);
  const servers = [];

  try {
    for (const port of ports) {
      const server = await openPort(port);
      servers.push(server);
    }
  } finally {
    await Promise.all(servers.map(closeServer));
  }
}

function parsePort(rawPort) {
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Release E2E ports must be integers between 1 and 65535.");
  }

  return port;
}

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.once("error", () => {
      reject(new Error(`Port ${port} is unavailable. Stop local services before running release E2E.`));
    });
    server.listen({ host: LOOPBACK_HOST, port, exclusive: true }, () => {
      resolve(server);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    await assertReleaseE2EPortsAvailable(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `Release E2E port preflight failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
