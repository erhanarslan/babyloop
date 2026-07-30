import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { metadata } from "./layout";

describe("backoffice production metadata", () => {
  it("publishes branded title, description and framework-native icon metadata", () => {
    expect(metadata.title).toBe("BabyLoop Backoffice");
    expect(metadata.description).toBe("BabyLoop operasyon ve yönetim konsolu");
    expect(metadata.icons).toMatchObject({
      icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
    });
  });

  it("embeds the existing BabyLoop favicon asset and relies on standalone metadata packaging", () => {
    const icon = readFileSync(resolve(process.cwd(), "src/app/icon.svg"), "utf8");
    const encoded = icon.match(/base64,([^"]+)/u)?.[1];
    const source = readFileSync(resolve(process.cwd(), "../web/public/brand/favicon-32.png"));
    const dockerfile = readFileSync(resolve(process.cwd(), "../../deploy/docker/Dockerfile"), "utf8");

    expect(encoded).toBeDefined();
    expect(Buffer.from(encoded!, "base64")).toEqual(source);
    expect(icon).toContain("<title>BabyLoop</title>");
    expect(dockerfile).toContain("/workspace/apps/backoffice/.next/standalone");
    expect(dockerfile).toContain("/workspace/apps/backoffice/.next/static");
  });
});
