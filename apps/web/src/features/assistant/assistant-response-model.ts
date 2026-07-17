export type WebAssistantMode = "rag" | "boundary" | "no_sources";

export type WebAssistantSourceCard = {
  id: string;
  label: string;
  reliability?: string;
  topic?: string;
};

export type WebAssistantActionCard = {
  href?: string;
  id: string;
  label: string;
  type: string;
};

export type WebAssistantToolPreview = {
  id: string;
  summary: string;
  title: string;
  tool: string;
};

export type WebAssistantResponse = {
  actionCards: WebAssistantActionCard[];
  answer: string;
  grounded: boolean;
  mode: WebAssistantMode;
  modeLabel: string;
  showGrounded: boolean;
  sourceCards: WebAssistantSourceCard[];
  toolPreviewCards: WebAssistantToolPreview[];
};

const allowedModes = new Set<WebAssistantMode>(["rag", "boundary", "no_sources"]);
const allowedInternalHrefPrefixes = [
  "/browse",
  "/listings/",
  "/sell",
  "/favorites",
  "/saved-searches",
  "/account/saved-searches",
  "/account/children",
  "/assistant",
  "/conversations",
  "/notifications"
];

export function normalizeWebAssistantResponse(payload: unknown): WebAssistantResponse {
  if (!isRecord(payload)) {
    throw new Error("Asistan yanıtı okunamadı.");
  }

  const answer = pickText(payload.answer, 4000);

  if (!answer) {
    throw new Error("Asistan yanıtı okunamadı.");
  }

  const mode = typeof payload.mode === "string" && allowedModes.has(payload.mode as WebAssistantMode)
    ? (payload.mode as WebAssistantMode)
    : "no_sources";
  const grounded = typeof payload.grounded === "boolean" ? payload.grounded : false;

  return {
    actionCards: normalizeActions(payload.suggestedActions ?? payload.actions),
    answer,
    grounded,
    mode,
    modeLabel: getWebAssistantModeLabel(mode),
    showGrounded: mode === "rag",
    sourceCards: mode === "rag" ? normalizeSources(payload.sources) : [],
    toolPreviewCards: normalizeToolPreviews(payload.toolResultsPreview)
  };
}

export function getWebAssistantModeLabel(mode: WebAssistantMode): string {
  switch (mode) {
    case "rag":
      return "Kaynaklı yanıt";
    case "boundary":
      return "Güvenlik sınırı";
    case "no_sources":
      return "Yeterli kaynak bulunamadı";
    default:
      return "Yeterli kaynak bulunamadı";
  }
}

export function isSafeWebAssistantHref(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const href = value.trim();

  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    href.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(href) ||
    /^https?:/iu.test(href) ||
    /^javascript:/iu.test(href) ||
    /^data:/iu.test(href)
  ) {
    return false;
  }

  return allowedInternalHrefPrefixes.some((prefix) => href === prefix || href.startsWith(prefix));
}

function normalizeSources(value: unknown): WebAssistantSourceCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const sources: WebAssistantSourceCard[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const title = pickText(item.title, 120);
    const section = pickText(item.section, 120);
    const topic = pickText(item.topic, 80);
    const reliability = pickText(item.sourceReliability, 80);
    // sourcePath is intentionally ignored so internal corpus paths never become user-facing display data.

    if (!title) {
      continue;
    }

    const key = `${title}:${section ?? ""}`.toLocaleLowerCase("tr-TR");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    sources.push({
      id: key,
      label: section ? `${title} · ${section}` : title,
      ...(reliability ? { reliability } : {}),
      ...(topic ? { topic } : {})
    });
  }

  return sources.slice(0, 5);
}

function normalizeActions(value: unknown): WebAssistantActionCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((action, index) => {
      const label = pickText(action.label, 80);
      const type = pickText(action.type, 80) ?? "open_search";
      const hasHref = "href" in action && action.href !== null && action.href !== undefined;
      const href = isSafeWebAssistantHref(action.href) ? action.href.trim().slice(0, 240) : undefined;

      if (!label || (hasHref && !href)) {
        return null;
      }

      return {
        id: `${type}-${index}`,
        label,
        type,
        ...(href ? { href } : {})
      };
    })
    .filter((action): action is WebAssistantActionCard => action !== null)
    .slice(0, 5);
}

function normalizeToolPreviews(value: unknown): WebAssistantToolPreview[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item, index) => {
      const tool = pickText(item.tool, 80);
      const title = pickText(item.title, 120);
      const summary = pickText(item.summary, 240);

      if (!tool || !title || !summary) {
        return null;
      }

      return {
        id: `${tool}-${index}`,
        summary,
        title,
        tool
      };
    })
    .filter((item): item is WebAssistantToolPreview => item !== null)
    .slice(0, 5);
}

function pickText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const sanitized = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/giu, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9._-]+/gu, "[redacted-token]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
    .replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu, "[redacted-token]")
    .trim()
    .slice(0, maxLength);

  return sanitized || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
