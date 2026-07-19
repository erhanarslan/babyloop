import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  resolveConfiguredApiOrigins
} from "../../config/content-security-policy.mjs";

describe("web content security policy", () => {
  it("allows the configured production API and matching secure websocket origin", () => {
    const policy = buildContentSecurityPolicy({
      apiBaseUrl: "https://api.babyloop.example/api/v1",
      nodeEnv: "production"
    });

    expect(policy).toContain(
      "connect-src 'self' https://api.babyloop.example wss://api.babyloop.example"
    );
    expect(policy).not.toMatch(/localhost|127\.0\.0\.1|unsafe-eval/u);
  });

  it("keeps local API origins development-only and ignores insecure production origins", () => {
    expect(
      buildContentSecurityPolicy({
        apiBaseUrl: "http://localhost:4000",
        nodeEnv: "development"
      })
    ).toContain("ws://localhost:4000");

    expect(resolveConfiguredApiOrigins("http://api.example.test", { allowInsecure: false })).toEqual([]);
    expect(resolveConfiguredApiOrigins("not-a-url", { allowInsecure: true })).toEqual([]);
  });
});
