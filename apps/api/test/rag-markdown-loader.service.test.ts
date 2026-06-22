import { describe, expect, it } from "vitest";
import { parseMarkdownWithFrontmatter } from "../src/services/rag-markdown-loader.service.js";

describe("rag markdown loader", () => {
  it("parses frontmatter and markdown content separately", () => {
    const parsed = parseMarkdownWithFrontmatter(`---
id: safe-shopping-guide
title: Güvenli alışveriş rehberi
locale: tr
topic: safe-shopping
sourceReliability: internal
---

# Güvenli alışveriş

Mesajlaşma BabyLoop içinde kalmalıdır.`);

    expect(parsed.frontmatter).toMatchObject({
      id: "safe-shopping-guide",
      locale: "tr",
      topic: "safe-shopping",
      sourceReliability: "internal"
    });
    expect(parsed.content).toContain("# Güvenli alışveriş");
  });

  it("returns empty frontmatter when no frontmatter block exists", () => {
    const parsed = parseMarkdownWithFrontmatter("# Başlık\n\nMetin");

    expect(parsed.frontmatter).toEqual({});
    expect(parsed.content).toContain("Metin");
  });
});
