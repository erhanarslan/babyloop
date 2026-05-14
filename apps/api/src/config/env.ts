export type ApiRuntimeConfig = {
  host: string;
  port: number;
};

export function readApiRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ApiRuntimeConfig {
  return {
    host: env.HOST ?? "127.0.0.1",
    port: readPort(env.PORT)
  };
}

function readPort(value: string | undefined): number {
  if (!value) {
    return 4000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}
