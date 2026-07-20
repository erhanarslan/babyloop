import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type ApiPackage = {
  scripts: Record<string, string>;
};

const apiPackage = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8")
) as ApiPackage;

describe("API local environment script contract", () => {
  it.each([
    "dev",
    "storage:smoke:r2",
    "notifications:smoke:marketplace-email"
  ])("loads the repository-root .env.local for %s", (scriptName) => {
    expect(apiPackage.scripts[scriptName]).toContain(
      "--env-file-if-exists=../../.env.local"
    );
  });

  it("does not load local development secrets in the production start command", () => {
    expect(apiPackage.scripts.start).toBe("node dist/server.js");
  });
});
