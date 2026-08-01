import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestAssistantMessage } from "./api";
import { AssistantPageContent } from "./assistant-page-content";

const analytics = vi.hoisted(() => ({
  track: vi.fn(),
  trackAssistantAnswer: vi.fn(),
  trackAssistantOpened: vi.fn()
}));

const source = readFileSync(join(process.cwd(), "src/features/assistant/assistant-page-content.tsx"), "utf8");
const styles = readFileSync(join(process.cwd(), "src/features/assistant/assistant-page-content.module.css"), "utf8");

vi.mock("./api", () => ({
  requestAssistantMessage: vi.fn()
}));
vi.mock("../analytics/use-analytics", () => ({
  useAnalytics: () => analytics
}));

describe("AssistantPageContent", () => {
  beforeEach(() => {
    vi.mocked(requestAssistantMessage).mockReset();
    analytics.track.mockReset();
    analytics.trackAssistantAnswer.mockReset();
    analytics.trackAssistantOpened.mockReset();
    window.history.replaceState({}, "", "/assistant");
  });

  it("renders one submit button in the same visual wrapper as the labelled textarea", () => {
    const { container } = render(<AssistantPageContent apiBaseUrl="http://api.test" />);
    const textarea = screen.getByRole("textbox", { name: "Sorunu yaz" });
    const submitButton = screen.getByRole("button", { name: "Sor" });
    const inputWrap = screen.getByTestId("assistant-composer-input-wrap");

    expect(inputWrap).toContainElement(textarea);
    expect(inputWrap).toContainElement(submitButton);
    expect(inputWrap.children).toHaveLength(2);
    expect(inputWrap.lastElementChild).toBe(submitButton);
    expect(submitButton).toHaveAttribute("type", "submit");
    expect(submitButton).toBeDisabled();
    expect(container.querySelectorAll('button[type="submit"]')).toHaveLength(1);

    expect(source).toContain('src="/brand/home/babyloop-logo-full-transparent.png"');
    expect(source).toContain('alt="BabyLoop"');
    expect(source).not.toContain("<h1>BabyLoop Asistan</h1>");
    expect(source).not.toContain("styles.composerShell");
    expect(source).not.toContain("styles.actions");
  });

  it("keeps pending and disabled submit semantics inside the textarea wrapper", async () => {
    let resolveRequest: ((value: {
      ok: true;
      data: { answer: string };
    }) => void) | undefined;
    vi.mocked(requestAssistantMessage).mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    render(<AssistantPageContent apiBaseUrl="http://api.test" />);
    const textarea = screen.getByRole("textbox", { name: "Sorunu yaz" });
    const submitButton = screen.getByRole("button", { name: "Sor" });

    fireEvent.change(textarea, { target: { value: "Güvenli ürün önerisi" } });
    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);

    const pendingButton = await screen.findByRole("button", { name: "Yanıt hazırlanıyor" });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveTextContent("Hazırlanıyor");
    expect(screen.getByTestId("assistant-composer-input-wrap")).toContainElement(pendingButton);

    resolveRequest?.({ ok: true, data: { answer: "Yanıt" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sor" })).toBeDisabled();
    });
  });

  it("keeps the submit control overlaid inside padded textarea space on every viewport", () => {
    expect(styles).toMatch(/\.composerInputWrap\s*\{[^}]*position:\s*relative;[^}]*width:\s*100%;/su);
    expect(styles).toMatch(/\.submitButton\s*\{[^}]*position:\s*absolute;[^}]*right:\s*0\.75rem;[^}]*bottom:\s*0\.75rem;[^}]*z-index:\s*1;/su);
    expect(styles).toMatch(/\.promptInput\s*\{[^}]*padding-right:\s*10rem;[^}]*padding-bottom:\s*4\.25rem;[^}]*resize:\s*vertical;/su);
    expect(styles).not.toMatch(/@media[^]*\.submitButton\s*\{[^}]*width:\s*100%/u);
    expect(styles).not.toContain(".actions");
    expect(styles).not.toContain(".composerShell");
  });

  it("uses the normalized assistant response display model", () => {
    expect(source).toContain("normalizeWebAssistantResponse");
    expect(source).toContain("modeLabel");
    expect(source).toContain("response.sourceCards");
    expect(source).toContain("response.actionCards");
  });

  it("tracks assistant open, question and canonical answer events", async () => {
    vi.mocked(requestAssistantMessage).mockResolvedValueOnce({
      ok: true,
      data: {
        answer: "Kaynaklı yanıt",
        grounded: true,
        mode: "rag",
        sources: [{ title: "Güvenli alışveriş", sourcePath: "internal.md" }]
      }
    });
    render(<AssistantPageContent apiBaseUrl="http://api.test" />);

    expect(analytics.trackAssistantOpened).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("textbox", { name: "Sorunu yaz" }), {
      target: { value: "Güvenli ürün nasıl seçilir?" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sor" }));

    await screen.findByText("Kaynaklı yanıt", { selector: "p" });
    expect(analytics.track).toHaveBeenCalledWith({
      eventName: "assistant_question_submitted",
      properties: { domain: "general", sourceSurface: "assistant" }
    });
    expect(analytics.trackAssistantAnswer).toHaveBeenCalledWith({
      grounded: true,
      mode: "rag",
      sourceCount: 1
    });
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
