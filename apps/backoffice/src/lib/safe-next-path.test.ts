import { describe, expect, it } from "vitest";

import { resolveSafeBackofficeNextPath } from "./safe-next-path";

describe("resolveSafeBackofficeNextPath", () => {
  it("accepts protected relative paths including query strings", () => {
    expect(resolveSafeBackofficeNextPath("/storage?tab=images")).toBe("/storage?tab=images");
  });

  it.each([
    "https://evil.example/storage",
    "//evil.example/storage",
    "%2F%2Fevil.example%2Fstorage",
    "%68%74%74%70%73%3A%2F%2Fevil.example",
  ])("rejects external next target %s", (value) => {
    expect(resolveSafeBackofficeNextPath(value)).toBe("/");
  });
});
