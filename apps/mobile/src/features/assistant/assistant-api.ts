import { apiRequest, isRecord } from "../../api/client";

export type MobileAssistantMode = "rag" | "boundary" | "no_sources";

export type MobileAssistantSource = {
  title: string;
  sourcePath?: string;
  section?: string;
  sourceReliability?: string;
};

export type MobileAssistantSuggestedAction = {
  type:
    | "open_listing"
    | "open_search"
    | "copy_questions"
    | "review_saved_search_draft"
    | "review_listing_draft"
    | "review_child_recommendations";
  label: string;
  href?: string;
};

export type MobileAssistantToolResultPreview = {
  tool: string;
  title: string;
  summary: string;
};

export type MobileAssistantAnswer = {
  answer: string;
  grounded: boolean;
  mode: MobileAssistantMode;
  sources: MobileAssistantSource[];
  suggestedActions: MobileAssistantSuggestedAction[];
  toolResultsPreview: MobileAssistantToolResultPreview[];
  toolsUsed: string[];
};

const allowedModes = new Set<MobileAssistantMode>(["rag", "boundary", "no_sources"]);
const allowedSuggestedActionTypes = new Set<MobileAssistantSuggestedAction["type"]>([
  "open_listing",
  "open_search",
  "copy_questions",
  "review_saved_search_draft",
  "review_listing_draft",
  "review_child_recommendations"
]);

export async function askMobileAssistant(message: string): Promise<MobileAssistantAnswer> {
  const result = await apiRequest<unknown>("/api/v1/assistant/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      locale: "tr",
      message
    })
  });

  if (!result.ok) {
    if (result.status === 429) {
      throw new Error("Asistan kullanım sınırına ulaşıldı. Biraz sonra tekrar deneyebilirsin.");
    }

    if (result.status === 503) {
      throw new Error("Asistan şu an hazırlanamadı. Daha sonra tekrar deneyebilirsin.");
    }

    throw new Error(result.error || "Asistan yanıtı alınamadı.");
  }

  return normalizeMobileAssistantAnswer(result.data);
}

export function normalizeMobileAssistantAnswer(payload: unknown): MobileAssistantAnswer {
  if (!isRecord(payload) || typeof payload.answer !== "string" || payload.answer.trim().length === 0) {
    throw new Error("Asistan yanıtı okunamadı.");
  }

  return {
    answer: sanitizeAssistantText(payload.answer, 4000),
    grounded: typeof payload.grounded === "boolean" ? payload.grounded : false,
    mode: normalizeAssistantMode(payload.mode),
    sources: normalizeAssistantSources(payload.sources),
    suggestedActions: normalizeAssistantSuggestedActions(payload.suggestedActions ?? payload.actions),
    toolResultsPreview: normalizeToolResults(payload.toolResultsPreview),
    toolsUsed: normalizeStringArray(payload.toolsUsed, 6, 80)
  };
}

export function isSafeMobileAssistantHref(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const href = value.trim();

  return (
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !/^https?:/iu.test(href) &&
    !/^javascript:/iu.test(href) &&
    !/^data:/iu.test(href)
  );
}

function normalizeAssistantMode(value: unknown): MobileAssistantMode {
  return typeof value === "string" && allowedModes.has(value as MobileAssistantMode)
    ? (value as MobileAssistantMode)
    : "no_sources";
}

function normalizeAssistantSources(value: unknown): MobileAssistantSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((source) => {
      const title = sanitizeAssistantText(source.title, 120);
      const section = sanitizeOptionalAssistantText(source.section, 120);
      const sourceReliability = sanitizeOptionalAssistantText(source.sourceReliability, 80);
      const sourcePath = sanitizeOptionalAssistantText(source.sourcePath, 240);

      if (!title) {
        return null;
      }

      return {
        title,
        ...(section ? { section } : {}),
        ...(sourceReliability ? { sourceReliability } : {}),
        ...(sourcePath ? { sourcePath } : {})
      };
    })
    .filter((source): source is MobileAssistantSource => source !== null)
    .slice(0, 6);
}

function normalizeAssistantSuggestedActions(value: unknown): MobileAssistantSuggestedAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((action) => {
      const type = typeof action.type === "string" && allowedSuggestedActionTypes.has(action.type as MobileAssistantSuggestedAction["type"])
        ? (action.type as MobileAssistantSuggestedAction["type"])
        : "open_search";
      const label = sanitizeAssistantText(action.label, 80);
      const hasHref = "href" in action && action.href !== null && action.href !== undefined;
      const href = isSafeMobileAssistantHref(action.href) ? action.href.trim().slice(0, 240) : undefined;

      if (!label || (hasHref && !href)) {
        return null;
      }

      return {
        type,
        label,
        ...(href ? { href } : {})
      };
    })
    .filter((action): action is MobileAssistantSuggestedAction => action !== null)
    .slice(0, 4);
}

function normalizeToolResults(value: unknown): MobileAssistantToolResultPreview[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => {
      const tool = sanitizeAssistantText(item.tool, 80);
      const title = sanitizeAssistantText(item.title, 120);
      const summary = sanitizeAssistantText(item.summary, 240);

      if (!tool || !title || !summary) {
        return null;
      }

      return {
        tool,
        title,
        summary
      };
    })
    .filter((item): item is MobileAssistantToolResultPreview => item !== null)
    .slice(0, 4);
}

function normalizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeAssistantText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeOptionalAssistantText(value: unknown, maxLength: number): string | undefined {
  const text = sanitizeAssistantText(value, maxLength);
  return text || undefined;
}

function sanitizeAssistantText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/giu, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9._-]+/gu, "[redacted-token]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
    .trim()
    .slice(0, maxLength);
}
