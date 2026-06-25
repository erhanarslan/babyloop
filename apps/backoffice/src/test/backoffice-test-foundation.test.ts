import { describe, expect, it } from "vitest";

describe("backoffice test foundation", () => {
  it("builds admin route URLs consistently", () => {
    const baseUrl = "http://localhost:3001";
    const loginUrl = new URL("/admin/login", baseUrl);

    expect(loginUrl.toString()).toBe("http://localhost:3001/admin/login");
    expect(loginUrl.pathname).toBe("/admin/login");
  });
});
