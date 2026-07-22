import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  resolveRedisTransport
} from "../src/services/rag-redis.service.js";

describe("rag redis TLS transport", () => {
  it("uses plain TCP only for redis URLs", () => {
    expect(
      resolveRedisTransport(new URL("redis://localhost:6379"))
    ).toEqual({
      protocol: "redis:",
      host: "localhost",
      port: 6379,
      secure: false
    });
  });

  it("requires TLS for rediss URLs", () => {
    expect(
      resolveRedisTransport(
        new URL("rediss://default:secret@example.upstash.io:6379")
      )
    ).toEqual({
      protocol: "rediss:",
      host: "example.upstash.io",
      port: 6379,
      secure: true
    });
  });

  it("rejects unsupported protocols", () => {
    expect(() =>
      resolveRedisTransport(new URL("http://example.com:6379"))
    ).toThrow(/Unsupported Redis protocol/u);
  });

  it("pins certificate verification and SNI in the TLS socket path", async () => {
    const source = await readFile(
      new URL("../src/services/rag-redis.service.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain('from "node:tls"');
    expect(source).toContain("servername: transport.host");
    expect(source).toContain("rejectUnauthorized: true");
    expect(source).toContain("socket = connectTls(");
  });
});
