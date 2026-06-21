import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMarkdownWithFrontmatter } from "../src/services/rag-markdown-loader.service.js";

const docsRoot = path.resolve(process.cwd(), "../../docs/rag");
const requiredKeys = [
  "id",
  "title",
  "locale",
  "topic",
  "safetyScope",
  "sourceReliability",
  "version"
];

describe("rag document metadata", () => {
  it("all docs/rag markdown files include required frontmatter", async () => {
    const files = (await fs.readdir(docsRoot))
      .filter((file) => file.endsWith(".md"))
      .sort();

    expect(files.length).toBeGreaterThanOrEqual(16);

    for (const file of files) {
      const raw = await fs.readFile(path.join(docsRoot, file), "utf8");
      const parsed = parseMarkdownWithFrontmatter(raw);

      for (const key of requiredKeys) {
        expect(parsed.frontmatter[key], `${file} missing ${key}`).toBeTruthy();
      }
    }
  });

  it("source policy declares internal-policy reliability", async () => {
    const raw = await fs.readFile(path.join(docsRoot, "15-rag-source-policy.md"), "utf8");
    const parsed = parseMarkdownWithFrontmatter(raw);

    expect(parsed.frontmatter.sourceReliability).toBe("internal-policy");
    expect(parsed.frontmatter.topic).toBe("rag-source-policy");
  });
});
