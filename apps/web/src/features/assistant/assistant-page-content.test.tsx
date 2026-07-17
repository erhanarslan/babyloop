import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/assistant/assistant-page-content.tsx"), "utf8");

describe("AssistantPageContent", () => {
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
});
