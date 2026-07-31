import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/assistant/assistant-page-content.tsx"), "utf8");

describe("AssistantPageContent", () => {
  it("uses the production logo and keeps the submit action inside the composer shell", () => {
    expect(source).toContain('src="/brand/home/babyloop-logo-full-transparent.png"');
    expect(source).toContain('alt="BabyLoop"');
    expect(source).not.toContain("<h1>BabyLoop Asistan</h1>");
    expect(source).toContain("<div className={styles.composerShell}>");

    const composerStart = source.indexOf("<div className={styles.composerShell}>");
    const composerEnd = source.indexOf("</form>", composerStart);
    const composerSource = source.slice(composerStart, composerEnd);
    expect(composerSource.match(/type="submit"/gu)).toHaveLength(1);
    expect(composerSource).toContain("Hazırlanıyor");
    expect(composerSource).toContain("disabled={isPending || inputValue.trim().length === 0}");
  });

  it("uses the normalized assistant response display model", () => {
    expect(source).toContain("normalizeWebAssistantResponse");
    expect(source).toContain("modeLabel");
    expect(source).toContain("response.sourceCards");
    expect(source).toContain("response.actionCards");
  });

  it("renders suggested actions through safe internal Next links only", () => {
    expect(source).toContain("<Link");
    expect(source).not.toContain("<a href={");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("keeps failed user messages retryable and guards out-of-order responses", () => {
    expect(source).toContain("lastFailedPrompt");
    expect(source).toContain("requestIdRef");
    expect(source).toContain("if (requestId !== requestIdRef.current)");
  });

  it("does not show the internal abuse limit as a visible character counter", () => {
    expect(source).not.toContain("inputValue.length");
    expect(source).not.toContain("/1000");
    expect(source).not.toContain("maxLength={1000}");
  });
});
