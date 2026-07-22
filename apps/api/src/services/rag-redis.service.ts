import { createHash } from "node:crypto";
import { Socket } from "node:net";
import { connect as connectTls } from "node:tls";

export type RagRedisStatus = {
  enabled: boolean;
  connected: boolean;
  backendEffective: "redis" | "memory" | "disabled";
};

export type RagRedisClientOptions = {
  enabled: boolean;
  keyPrefix: string;
  url?: string;
  connectTimeoutMs: number;
};

export class RagRedisClient {
  readonly enabled: boolean;
  readonly keyPrefix: string;
  private readonly connectTimeoutMs: number;
  private readonly redisUrl: URL | null;
  private connected = false;

  constructor(options: RagRedisClientOptions) {
    this.enabled = options.enabled;
    this.keyPrefix = options.keyPrefix.replace(/:+$/u, "");
    this.connectTimeoutMs = options.connectTimeoutMs;
    this.redisUrl = options.enabled && options.url ? new URL(options.url) : null;
  }

  status(effective: "redis" | "memory" | "disabled"): RagRedisStatus {
    return {
      enabled: this.enabled,
      connected: this.connected,
      backendEffective: effective
    };
  }

  key(...parts: string[]): string {
    return [this.keyPrefix, ...parts.map((part) => sanitizeKeyPart(part))].join(":");
  }

  hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  async ping(): Promise<boolean> {
    const value = await this.command(["PING"]);
    return value === "PONG";
  }

  async get(key: string): Promise<string | null> {
    const value = await this.command(["GET", key]);
    return typeof value === "string" ? value : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.command(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
  }

  async incr(key: string): Promise<number> {
    const value = await this.command(["INCR", key]);
    return typeof value === "number" ? value : 0;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.command(["EXPIRE", key, String(ttlSeconds)]);
  }

  async ttl(key: string): Promise<number> {
    const value = await this.command(["TTL", key]);
    return typeof value === "number" ? value : -1;
  }

  async del(keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const value = await this.command(["DEL", ...keys]);
    return typeof value === "number" ? value : 0;
  }

  async scan(matchPattern: string, count = 100): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";

    do {
      const value = await this.command(["SCAN", cursor, "MATCH", matchPattern, "COUNT", String(count)]);

      if (!Array.isArray(value) || typeof value[0] !== "string" || !Array.isArray(value[1])) {
        break;
      }

      cursor = value[0];
      keys.push(...value[1].filter((item): item is string => typeof item === "string"));
    } while (cursor !== "0");

    return keys;
  }

  private async command(args: string[]): Promise<RedisValue> {
    if (!this.enabled || !this.redisUrl) {
      throw new Error("Redis is disabled.");
    }

    const password = this.redisUrl.password ? decodeURIComponent(this.redisUrl.password) : "";
    const username = this.redisUrl.username ? decodeURIComponent(this.redisUrl.username) : "";
    const db = this.redisUrl.pathname.replace(/^\//u, "");
    let socket: Socket | null = null;
    let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

    try {
      socket = await connectSocket(this.redisUrl, this.connectTimeoutMs);
      this.connected = true;

      if (password) {
        await writeAndRead(socket, username ? ["AUTH", username, password] : ["AUTH", password], (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          const parsed = parseResp(buffer);
          if (parsed) buffer = parsed.rest;
          return parsed?.value;
        });
      }

      if (db && db !== "0") {
        await writeAndRead(socket, ["SELECT", db], (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          const parsed = parseResp(buffer);
          if (parsed) buffer = parsed.rest;
          return parsed?.value;
        });
      }

      return await writeAndRead(socket, args, (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const parsed = parseResp(buffer);
        if (parsed) buffer = parsed.rest;
        return parsed?.value;
      });
    } catch (error) {
      this.connected = false;
      throw error;
    } finally {
      socket?.destroy();
    }
  }
}

type RedisValue = string | number | null | RedisValue[];

function sanitizeKeyPart(value: string): string {
  return value.trim().toLocaleLowerCase("tr").replace(/[^a-z0-9:_-]+/giu, "-").replace(/^-|-$/gu, "").slice(0, 120) || "empty";
}

export type RagRedisTransport = {
  protocol: "redis:" | "rediss:";
  host: string;
  port: number;
  secure: boolean;
};

export function resolveRedisTransport(redisUrl: URL): RagRedisTransport {
  if (redisUrl.protocol !== "redis:" && redisUrl.protocol !== "rediss:") {
    throw new Error(`Unsupported Redis protocol: ${redisUrl.protocol}`);
  }

  if (!redisUrl.hostname) {
    throw new Error("Redis host is required.");
  }

  const port = Number(redisUrl.port || "6379");

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Redis port is invalid.");
  }

  return {
    protocol: redisUrl.protocol,
    host: redisUrl.hostname,
    port,
    secure: redisUrl.protocol === "rediss:"
  };
}

function connectSocket(redisUrl: URL, timeoutMs: number): Promise<Socket> {
  const transport = resolveRedisTransport(redisUrl);

  return new Promise((resolve, reject) => {
    let socket: Socket | null = null;
    let timer: NodeJS.Timeout | null = null;
    let settled = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      socket?.off("error", onError);
    };

    const onConnect = () => {
      if (settled || !socket) return;
      settled = true;
      cleanup();
      resolve(socket);
    };

    const onError = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      socket?.destroy();
      reject(error);
    };

    try {
      if (transport.secure) {
        socket = connectTls(
          {
            host: transport.host,
            port: transport.port,
            servername: transport.host,
            rejectUnauthorized: true
          },
          onConnect
        );
      } else {
        socket = new Socket();
        socket.once("connect", onConnect);
        socket.connect(transport.port, transport.host);
      }

      socket.once("error", onError);
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        socket?.destroy();
        reject(new Error("Redis connection timed out."));
      }, timeoutMs);
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function writeAndRead(
  socket: Socket,
  args: string[],
  read: (chunk: Buffer) => RedisValue | undefined
): Promise<RedisValue> {
  return new Promise((resolve, reject) => {
    function onData(chunk: Buffer) {
      try {
        const value = read(chunk);

        if (value !== undefined) {
          cleanup();
          resolve(value);
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    }

    function onError(error: Error) {
      cleanup();
      reject(error);
    }

    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
    }

    socket.on("data", onData);
    socket.once("error", onError);
    socket.write(encodeCommand(args));
  });
}

function encodeCommand(args: string[]): string {
  return `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join("")}`;
}

function parseResp(buffer: Buffer): { value: RedisValue; rest: Buffer } | null {
  if (buffer.length === 0) {
    return null;
  }

  const prefix = String.fromCharCode(buffer[0] ?? 0);
  const lineEnd = buffer.indexOf("\r\n");

  if (lineEnd === -1) {
    return null;
  }

  const line = buffer.subarray(1, lineEnd).toString("utf8");
  const rest = buffer.subarray(lineEnd + 2);

  if (prefix === "+") {
    return { value: line, rest };
  }

  if (prefix === "-") {
    throw new Error("Redis command failed.");
  }

  if (prefix === ":") {
    return { value: Number(line), rest };
  }

  if (prefix === "$") {
    const length = Number(line);

    if (length === -1) {
      return { value: null, rest };
    }

    if (rest.length < length + 2) {
      return null;
    }

    return {
      value: rest.subarray(0, length).toString("utf8"),
      rest: rest.subarray(length + 2)
    };
  }

  if (prefix === "*") {
    const count = Number(line);
    let remaining = rest;
    const values: RedisValue[] = [];

    for (let index = 0; index < count; index += 1) {
      const parsed = parseResp(remaining);

      if (!parsed) {
        return null;
      }

      values.push(parsed.value);
      remaining = parsed.rest;
    }

    return {
      value: values,
      rest: remaining
    };
  }

  throw new Error("Unsupported Redis response.");
}
