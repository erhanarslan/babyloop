import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMarkdownWithFrontmatter } from "../src/services/rag-markdown-loader.service.js";
import {
  RAG_ALLOWED_SOURCE_RELIABILITY,
  RAG_REQUIRED_FRONTMATTER
} from "../src/services/rag-knowledge-governance.service.js";

const docsRoot = path.resolve(process.cwd(), "../../docs/rag");

describe("rag document metadata", () => {
  it("all docs/rag markdown files include valid required frontmatter", async () => {
    const files = (await fs.readdir(docsRoot))
      .filter((file) => file.endsWith(".md"))
      .sort();
    const ids = new Set<string>();

    expect(files.length).toBeGreaterThanOrEqual(16);

    for (const file of files) {
      const raw = await fs.readFile(path.join(docsRoot, file), "utf8");
      const parsed = parseMarkdownWithFrontmatter(raw);

      for (const key of RAG_REQUIRED_FRONTMATTER) {
        expect(parsed.frontmatter[key], `${file} missing ${key}`).toBeTruthy();
      }

      expect(ids.has(parsed.frontmatter.id), `${file} duplicate id ${parsed.frontmatter.id}`).toBe(false);
      ids.add(parsed.frontmatter.id);
      expect(parsed.frontmatter.locale, `${file} unsupported locale`).toBe("tr");
      expect(parsed.frontmatter.title.trim(), `${file} empty title`).not.toBe("");
      expect(parsed.frontmatter.topic.trim(), `${file} empty topic`).not.toBe("");
      expect(parsed.frontmatter.version.trim(), `${file} empty version`).not.toBe("");
      expect(RAG_ALLOWED_SOURCE_RELIABILITY, `${file} invalid sourceReliability`).toContain(parsed.frontmatter.sourceReliability);
    }
  });

  it("source policy declares internal-policy reliability", async () => {
    const raw = await fs.readFile(path.join(docsRoot, "15-rag-source-policy.md"), "utf8");
    const parsed = parseMarkdownWithFrontmatter(raw);

    expect(parsed.frontmatter.sourceReliability).toBe("internal-policy");
    expect(parsed.frontmatter.topic).toBe("rag-source-policy");
  });
});
