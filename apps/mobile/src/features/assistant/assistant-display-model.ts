import type {
  MobileAssistantAnswer,
  MobileAssistantSuggestedAction
} from "./assistant-api";

export type MobileAssistantSourceDisplay = {
  id: string;
  label: string;
  reliability?: string;
};

export type MobileAssistantActionDisplay = {
  id: string;
  href?: string;
  label: string;
  type: MobileAssistantSuggestedAction["type"];
};

export type MobileAssistantAnswerDisplay = {
  actionCards: MobileAssistantActionDisplay[];
  groundedLabel: string;
  modeLabel: string;
  showGrounded: boolean;
  sourceCards: MobileAssistantSourceDisplay[];
  toolPreviewCards: Array<{
    id: string;
    title: string;
    summary: string;
  }>;
};

export function buildMobileAssistantAnswerDisplay(answer: MobileAssistantAnswer): MobileAssistantAnswerDisplay {
  return {
    actionCards: buildActionCards(answer.suggestedActions),
    groundedLabel: answer.grounded ? "Kaynaklarla destekli" : "Genel yönlendirme",
    modeLabel: getAssistantModeLabel(answer.mode),
    showGrounded: answer.mode === "rag",
    sourceCards: answer.mode === "rag" ? buildSourceCards(answer) : [],
    toolPreviewCards: answer.toolResultsPreview.map((preview, index) => ({
      id: `${preview.tool}-${index}`,
      title: preview.title,
      summary: preview.summary
    }))
  };
}

export function getAssistantModeLabel(mode: MobileAssistantAnswer["mode"]): string {
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

function buildSourceCards(answer: MobileAssistantAnswer): MobileAssistantSourceDisplay[] {
  const seen = new Set<string>();
  const cards: MobileAssistantSourceDisplay[] = [];

  for (const source of answer.sources) {
    const key = `${source.title}:${source.section ?? ""}`.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    cards.push({
      id: key,
      label: source.section ? `${source.title} · ${source.section}` : source.title,
      ...(source.sourceReliability ? { reliability: source.sourceReliability } : {})
    });
  }

  return cards.slice(0, 4);
}

function buildActionCards(actions: MobileAssistantSuggestedAction[]): MobileAssistantActionDisplay[] {
  return actions
    .filter((action) => !action.href || isSafeMobileAssistantActionHref(action.href))
    .map((action, index) => ({
      id: `${action.type}-${index}`,
      label: action.label,
      type: action.type,
      ...(action.href ? { href: action.href } : {})
    }))
    .slice(0, 4);
}

function isSafeMobileAssistantActionHref(value: string): boolean {
  const href = value.trim();

  return href.startsWith("/") &&
    !href.startsWith("//") &&
    !/^https?:/iu.test(href) &&
    !/^javascript:/iu.test(href) &&
    !/^data:/iu.test(href);
}
