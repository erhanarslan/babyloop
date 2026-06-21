import { promises as fs } from "node:fs";
import path from "node:path";
import type { RagDocument, RagDocumentMetadata } from "./rag.types.js";

type Frontmatter = Record<string, string>;

export async function loadRagDocuments(docsRoot: string): Promise<RagDocument[]> {
  const entries = await fs.readdir(docsRoot, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const documents: RagDocument[] = [];

  for (const filename of markdownFiles) {
    const absolutePath = path.join(docsRoot, filename);
    const rawContent = await fs.readFile(absolutePath, "utf8");
    const parsed = parseMarkdownWithFrontmatter(rawContent);
    const sourcePath = path.posix.join("docs/rag", filename);
    const metadata = normalizeDocumentMetadata(parsed.frontmatter, sourcePath);

    documents.push({
      metadata,
      content: parsed.content
    });
  }

  return documents;
}

export function parseMarkdownWithFrontmatter(rawContent: string): {
  frontmatter: Frontmatter;
  content: string;
} {
  const normalized = rawContent.replace(/\r\n/g, "\n");

  if (!normalized.startsWith("---\n")) {
    return {
      frontmatter: {},
      content: normalized.trim()
    };
  }

  const endIndex = normalized.indexOf("\n---", 4);

  if (endIndex === -1) {
    return {
      frontmatter: {},
      content: normalized.trim()
    };
  }

  const frontmatterText = normalized.slice(4, endIndex).trim();
  const content = normalized.slice(endIndex + 4).trim();
  const frontmatter: Frontmatter = {};

  for (const line of frontmatterText.split("\n")) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && value) {
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter,
    content
  };
}

function normalizeDocumentMetadata(frontmatter: Frontmatter, sourcePath: string): RagDocumentMetadata {
  return {
    id: frontmatter.id ?? path.basename(sourcePath, ".md"),
    title: frontmatter.title ?? path.basename(sourcePath, ".md"),
    locale: frontmatter.locale ?? "tr",
    topic: frontmatter.topic ?? "general",
    safetyScope: frontmatter.safetyScope ?? "marketplace-guidance",
    version: frontmatter.version ?? "2026-06-18",
    sourcePath
  };
}
