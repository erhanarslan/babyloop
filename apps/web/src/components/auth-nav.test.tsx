import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/auth-nav.tsx"), "utf8");

describe("AuthNav bootstrap", () => {
  it("restores cookie-backed sessions on initial mount without polling", () => {
    expect(source).toMatch(/\n\s*loadWithRefresh\(\);/u);
    expect(source).not.toContain("setInterval(");
    expect(source).not.toContain("5000");
  });

  it("reacts to auth events and visibility without refresh storms", () => {
    expect(source).toContain("AUTH_CHANGED_EVENT");
    expect(source).toContain("AUTH_SESSION_ENDED_EVENT");
    expect(source).toContain("visibilitychange");
    expect(source).toContain("checkOnFocus");
  });

  it("does not treat API unavailable as logged out state", () => {
    expect(source).toContain("API_UNAVAILABLE");
    expect(source).toContain("return;");
  });
});
