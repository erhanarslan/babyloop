import { createHash } from "node:crypto";
import type { RagChunk, RagDocument } from "./rag.types.js";

const DEFAULT_TARGET_CHARS = 1_100;
const DEFAULT_OVERLAP_CHARS = 160;
const MIN_CHUNK_CHARS = 120;

export type ChunkMarkdownOptions = {
  targetChars?: number;
  overlapChars?: number;
};

export function chunkRagDocument(document: RagDocument, options: ChunkMarkdownOptions = {}): RagChunk[] {
  const targetChars = options.targetChars ?? DEFAULT_TARGET_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const sections = splitMarkdownIntoSections(document.content);
  const chunks: RagChunk[] = [];

  for (const section of sections) {
    const textChunks = splitText(section.text, targetChars, overlapChars);

    for (const text of textChunks) {
      const chunkIndex = chunks.length;
      const metadata = {
        ...document.metadata,
        documentId: document.metadata.id,
        section: section.heading,
        chunkIndex
      };

      chunks.push({
        id: createDeterministicChunkId(document.metadata.id, document.metadata.version, chunkIndex),
        text,
        metadata
      });
    }
  }

  return chunks;
}

export function createDeterministicChunkId(documentId: string, version: string, chunkIndex: number): string {
  const hash = createHash("sha256")
    .update(`${documentId}:${version}:${chunkIndex}`)
    .digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.slice(18, 20)}`,
    hash.slice(20, 32)
  ].join("-");
}

function splitMarkdownIntoSections(content: string): Array<{ heading: string; text: string }> {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ heading: string; lines: string[] }> = [];
  let current = {
    heading: "Genel",
    lines: [] as string[]
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,3})\s+(.+)$/u.exec(line.trim());

    if (headingMatch?.[2]) {
      if (current.lines.join("\n").trim()) {
        sections.push(current);
      }

      current = {
        heading: headingMatch[2].trim(),
        lines: [line]
      };
      continue;
    }

    current.lines.push(line);
  }

  if (current.lines.join("\n").trim()) {
    sections.push(current);
  }

  return sections
    .map((section) => ({
      heading: section.heading,
      text: section.lines.join("\n").trim()
    }))
    .filter((section) => section.text.length >= MIN_CHUNK_CHARS);
}

function splitText(text: string, targetChars: number, overlapChars: number): string[] {
  const normalizedParagraphs = text
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of normalizedParagraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;

    if (next.length <= targetChars || current.length < MIN_CHUNK_CHARS) {
      current = next;
      continue;
    }

    chunks.push(current.trim());
    current = buildOverlap(current, overlapChars, paragraph);
  }

  if (current.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push(current.trim());
  }

  return chunks;
}

function buildOverlap(previous: string, overlapChars: number, nextParagraph: string): string {
  if (previous.length <= overlapChars) {
    return `${previous}\n\n${nextParagraph}`.trim();
  }

  const overlap = previous.slice(-overlapChars).replace(/^\S+\s/u, "").trim();

  return overlap ? `${overlap}\n\n${nextParagraph}` : nextParagraph;
}
