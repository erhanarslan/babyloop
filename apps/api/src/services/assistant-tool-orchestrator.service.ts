import { buildRetrievalQuery } from "./rag-query-normalizer.service.js";
import {
  AssistantToolRegistry,
  type AssistantToolName
} from "./assistant-tool-registry.service.js";
import type { AssistantIntent } from "./assistant-intent-router.service.js";
import type { AssistantToolContext, AssistantToolResult } from "./assistant-tools.types.js";
import type { RagAnswer } from "./rag.types.js";

type ToolExecutionResult = {
  tool: AssistantToolName;
  input: unknown;
  result: AssistantToolResult<unknown>;
};

export type AssistantToolOrchestrationResult = {
  handled: boolean;
  answer?: Omit<RagAnswer, "cacheHit" | "intent" | "mode"> & {
    mode?: RagAnswer["mode"];
  };
};

export class AssistantToolOrchestrator {
  private readonly maxToolCalls: number;
  private readonly registry: AssistantToolRegistry;
  private readonly timeoutMs: number;

  constructor(options: {
    maxToolCalls?: number;
    registry?: AssistantToolRegistry;
    timeoutMs?: number;
  } = {}) {
    this.maxToolCalls = Math.max(1, options.maxToolCalls ?? 3);
    this.registry = options.registry ?? new AssistantToolRegistry();
    this.timeoutMs = Math.max(100, options.timeoutMs ?? 1_500);
  }

  async orchestrate(input: {
    context: AssistantToolContext;
    intent: AssistantIntent;
    message: string;
  }): Promise<AssistantToolOrchestrationResult> {
    const plan = this.plan(input.intent, input.message).slice(0, this.maxToolCalls);

    if (plan.length === 0) {
      return { handled: false };
    }

    const results: ToolExecutionResult[] = [];

    for (const step of plan) {
      const result = await withTimeout(
        this.registry.execute(step.tool, input.context, step.input),
        this.timeoutMs
      );
      results.push({ ...step, result });
    }

    return this.compose(input.intent, input.message, results);
  }

  private plan(intent: AssistantIntent, message: string): Array<{ tool: AssistantToolName; input: unknown }> {
    const analysis = buildRetrievalQuery(message);
    const primaryProduct = analysis.productTerms[0] ?? extractLooseProduct(message) ?? "ürün";
    const city = analysis.locationSignals[0];
    const listingId = extractListingId(message);

    if (intent === "listing_search") {
      return [
        { tool: "listing_search", input: { query: primaryProduct, ...(city ? { city } : {}), limit: 5 } },
        { tool: "rag_search", input: { query: `${primaryProduct} alırken nelere dikkat edilmeli?`, limit: 3 } }
      ];
    }

    if (intent === "listing_detail") {
      return listingId
        ? [
            { tool: "listing_detail", input: { listingId } },
            { tool: "rag_search", input: { query: `${primaryProduct} güvenli alışveriş kontrol`, limit: 3 } }
          ]
        : [{ tool: "rag_search", input: { query: message, limit: 3 } }];
    }

    if (intent === "buyer_questions") {
      return [
        { tool: "buyer_question_templates", input: { productType: primaryProduct } },
        { tool: "rag_search", input: { query: `${primaryProduct} satıcıya sorulacak sorular`, limit: 3 } }
      ];
    }

    if (intent === "listing_help") {
      return [
        { tool: "listing_draft_helper", input: { productType: primaryProduct, notes: message } },
        { tool: "rag_search", input: { query: `${primaryProduct} ilan yazımı fotoğraf kalitesi`, limit: 3 } }
      ];
    }

    if (intent === "child_needs" && !isInformationalChildKnowledgeQuestion(message)) {
      return [
        {
          tool: "child_needs_recommendations",
          input: {
            query: message,
            ...(city ? { city } : {}),
            ...(analysis.ageSignals[0] ? { ageSignal: analysis.ageSignals[0] } : {}),
            ...(analysis.productTerms.length > 0 ? { productTerms: analysis.productTerms } : {})
          }
        },
        {
          tool: "saved_search_suggest_draft",
          input: {
            query: primaryProduct === "ürün" ? message : primaryProduct,
            ...(city ? { city } : {}),
            ...(analysis.ageSignals[0] ? { ageSignal: analysis.ageSignals[0] } : {}),
            ...(analysis.productTerms.length > 0 ? { productTerms: analysis.productTerms } : {})
          }
        },
        { tool: "rag_search", input: { query: `${message} yaşa göre ürün ihtiyaçları mevsimsel ihtiyaçlar`, limit: 3 } }
      ];
    }

    if (intent === "saved_search_suggestion") {
      return [
        {
          tool: "saved_search_suggest_draft",
          input: {
            query: primaryProduct,
            ...(city ? { city } : {}),
            ...(analysis.ageSignals[0] ? { ageSignal: analysis.ageSignals[0] } : {}),
            ...(analysis.productTerms.length > 0 ? { productTerms: analysis.productTerms } : {})
          }
        }
      ];
    }

    if (intent === "category_lookup") {
      return [{ tool: "category_lookup", input: { query: message } }];
    }

    if (intent === "seller_summary") {
      return listingId
        ? [
            { tool: "seller_public_summary", input: { listingId } },
            { tool: "rag_search", input: { query: "güvenli alışveriş satıcı değerlendirme", limit: 3 } }
          ]
        : [{ tool: "rag_search", input: { query: "güvenli alışveriş satıcı değerlendirme", limit: 3 } }];
    }

    return [];
  }

  private compose(intent: AssistantIntent, message: string, results: ToolExecutionResult[]): AssistantToolOrchestrationResult {
    const toolsUsed = results.filter((entry) => entry.result.ok).map((entry) => entry.tool);
    const sources = results.flatMap((entry) => entry.tool === "rag_search" && entry.result.ok && Array.isArray(entry.result.data)
      ? entry.result.data.map((result) => result.citation)
      : []);
    const preview = results
      .filter((entry) => entry.result.ok)
      .map((entry) => previewToolResult(entry.tool, entry.result.ok ? entry.result.data : null))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    if (intent === "listing_search") {
      const listingData = dataFor<{ available: boolean; results: Array<{ title: string; href: string; price?: string; category?: string; condition?: string; city?: string }>; fallbackHref: string }>(results, "listing_search");
      const lines = listingData?.results.slice(0, 5).map((listing) => {
        const details = [listing.price, listing.category, listing.condition, listing.city].filter(Boolean).join(" · ");
        return `- ${listing.title}${details ? ` · ${details}` : ""} (${listing.href})`;
      }) ?? [];
      const href = listingData?.fallbackHref ?? `/browse?${new URLSearchParams({ q: message }).toString()}`;

      return {
        handled: true,
        answer: {
          answer: lines.length > 0
            ? `Bulduğum bazı ilanlar:\n${lines.join("\n")}\n\nDaha fazla sonuç için arama sayfasını açabilirsin.`
            : `Bu sorguya uygun ilan bulamadım. Aramayı genişletmek için arama sayfasını kullanabilirsin: ${href}`,
          sources,
          grounded: sources.length > 0,
          toolsUsed,
          toolResultsPreview: preview,
          suggestedActions: [
            { type: "open_search", label: "Aramayı aç", href },
            ...((listingData?.results ?? []).slice(0, 3).map((listing) => ({
              type: "open_listing" as const,
              label: listing.title,
              href: listing.href
            })))
          ]
        }
      };
    }

    if (intent === "buyer_questions") {
      const questionData = dataFor<{ questions: string[]; topic: string }>(results, "buyer_question_templates");
      const questions = questionData?.questions ?? [];

      return {
        handled: true,
        answer: {
          answer: questions.length > 0
            ? `Satıcıya şu soruları sorabilirsin:\n${questions.map((question) => `- ${question}`).join("\n")}`
            : "Satıcıya kullanım süresi, eksik parça, hasar ve güncel fotoğraf durumunu sorabilirsin.",
          sources,
          grounded: sources.length > 0,
          toolsUsed,
          toolResultsPreview: preview,
          suggestedActions: [{
            type: "copy_questions",
            label: "Soruları kopyala",
            payload: { questions }
          }]
        }
      };
    }

    if (intent === "listing_help") {
      const draft = dataFor<{ titleSuggestions: string[]; descriptionDraft: string; photoChecklist: string[] }>(results, "listing_draft_helper");

      return {
        handled: true,
        answer: {
          answer: draft
            ? `Taslak başlıklar:\n${draft.titleSuggestions.map((title) => `- ${title}`).join("\n")}\n\nAçıklama taslağı:\n${draft.descriptionDraft}\n\nFotoğraf kontrolü:\n${draft.photoChecklist.map((item) => `- ${item}`).join("\n")}\n\nBu yalnızca taslaktır; ilanı kullanıcı onayı olmadan oluşturmaz veya güncellemez.`
            : "İlan taslağı için ürün tipi, durum ve kısa notlar yeterli olur. Bu yalnızca taslaktır; otomatik ilan oluşturulmaz.",
          sources,
          grounded: sources.length > 0,
          toolsUsed,
          toolResultsPreview: preview,
          suggestedActions: [{
            type: "review_listing_draft",
            label: "Taslağı gözden geçir",
            payload: draft ? { draft } : {}
          }]
        }
      };
    }

    if (intent === "child_needs" && !isInformationalChildKnowledgeQuestion(message)) {
      const childDraft = dataFor<{
        hasChildContext: boolean;
        childLabel: string;
        ageBand: string | null;
        ageBandLabel: string | null;
        seasonLabel: string;
        suggestedSearches: Array<{ label: string; query: string; reason: string; filters: Record<string, string> }>;
        productFocus: string[];
        note: string;
      }>(results, "child_needs_recommendations");
      const savedSearchDraft = dataFor<{ suggestedSearches: Array<{ label: string; query: string; filters: Record<string, string>; reason: string }> }>(results, "saved_search_suggest_draft");
      const suggestions = childDraft?.suggestedSearches ?? savedSearchDraft?.suggestedSearches ?? [];
      const heading = childDraft?.hasChildContext
        ? `${childDraft.childLabel} için ${childDraft.ageBandLabel ?? "genel dönem"} önerileri`
        : "Yaş ve mevsime göre genel takip önerileri";

      return {
        handled: true,
        answer: {
          answer: suggestions.length > 0
            ? `${heading}:\n${suggestions.slice(0, 5).map((item) => `- ${item.label}: ${item.query} — ${item.reason}`).join("\n")}\n\n${childDraft?.note ?? "Bu sadece taslaktır; kullanıcı onayı olmadan kayıtlı arama veya bildirim oluşturulmaz."}`
            : "Çocuk yaş dönemi ve mevsime göre takip edilecek ürün taslakları hazırlayabilirim. Bu yalnızca öneridir; otomatik kayıt veya bildirim oluşturulmaz.",
          sources,
          grounded: sources.length > 0,
          toolsUsed,
          toolResultsPreview: preview,
          suggestedActions: [
            {
              type: "review_child_recommendations",
              label: "Çocuk önerilerini gözden geçir",
              payload: childDraft ? { childRecommendations: childDraft.suggestedSearches } : {}
            },
            {
              type: "review_saved_search_draft",
              label: "Kayıtlı arama taslağını gözden geçir",
              payload: { suggestedSearches: suggestions }
            }
          ]
        }
      };
    }

    if (intent === "saved_search_suggestion") {
      const draft = dataFor<{ suggestedSearches: Array<{ label: string; query: string; filters: Record<string, string>; reason: string }>; note: string }>(results, "saved_search_suggest_draft");

      return {
        handled: true,
        answer: {
          answer: draft
            ? `Kayıtlı arama taslakları:\n${draft.suggestedSearches.map((item) => `- ${item.label}: ${item.query}`).join("\n")}\n\n${draft.note}`
            : "Kayıtlı arama için bir taslak hazırlayabilirim; kullanıcı onayı olmadan kayıt oluşturulmaz.",
          sources: [],
          grounded: false,
          toolsUsed,
          toolResultsPreview: preview,
          suggestedActions: [{
            type: "review_saved_search_draft",
            label: "Kayıtlı arama taslağını gözden geçir",
            payload: draft ? { suggestedSearches: draft.suggestedSearches } : {}
          }]
        }
      };
    }

    if (intent === "category_lookup") {
      const categories = dataFor<Array<{ label: string; href: string; aliases: string[] }>>(results, "category_lookup") ?? [];
      return {
        handled: true,
        answer: {
          answer: categories.length > 0
            ? `Bu ihtiyaç için uygun kategori önerileri:\n${categories.map((category) => `- ${category.label} (${category.href})`).join("\n")}`
            : "Uygun kategori bulamadım. Ürünün adını biraz daha net yazabilirsin.",
          sources: [],
          grounded: false,
          toolsUsed,
          toolResultsPreview: preview,
          suggestedActions: categories.slice(0, 3).map((category) => ({
            type: "open_search" as const,
            label: category.label,
            href: category.href
          }))
        }
      };
    }

    if (intent === "listing_detail") {
      const detailData = dataFor<{ available: boolean; detail: { title: string; href: string; price?: string; category?: string; condition?: string; city?: string } | null }>(results, "listing_detail");
      const detail = detailData?.detail;

      return {
        handled: true,
        answer: {
          answer: detail
            ? `İlan özeti: ${detail.title}${detail.price ? ` · ${detail.price}` : ""}${detail.category ? ` · ${detail.category}` : ""}${detail.condition ? ` · ${detail.condition}` : ""}${detail.city ? ` · ${detail.city}` : ""}\n\nKesin güvenlik garantisi veremem; ürün ve teslim detaylarını BabyLoop mesajlaşmasında netleştir.`
            : "Bu ilan için public-safe detay bulamadım. İlan gizli, kaldırılmış veya uygun durumda olmayabilir.",
          sources,
          grounded: sources.length > 0,
          toolsUsed,
          toolResultsPreview: preview
        }
      };
    }

    if (intent === "seller_summary") {
      const sellerData = dataFor<{ available: boolean; seller: { displayName?: string; city?: string; publicTrustHints?: string[] } | null }>(results, "seller_public_summary");
      const seller = sellerData?.seller;

      return {
        handled: true,
        answer: {
          answer: seller
            ? `Satıcı public özeti: ${seller.displayName ?? "Satıcı"}${seller.city ? ` · ${seller.city}` : ""}\n\nKesin güvenilirlik garantisi veremem. BabyLoop mesajlaşmasını kullan, ödeme ve teslim detaylarını yazılı netleştir.`
            : "Bu satıcı için public-safe özet bulamadım. İlan veya satıcı bilgisi gizli olabilir.",
          sources,
          grounded: sources.length > 0,
          toolsUsed,
          toolResultsPreview: preview
        }
      };
    }

    return { handled: false };
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | {
  ok: false;
  code: "TOOL_UNAVAILABLE";
  message: string;
}> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<{
        ok: false;
        code: "TOOL_UNAVAILABLE";
        message: string;
      }>((resolve) => {
        timeout = setTimeout(() => resolve({
          ok: false,
          code: "TOOL_UNAVAILABLE",
          message: "Araç zaman aşımına uğradı."
        }), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}


function isInformationalChildKnowledgeQuestion(message: string): boolean {
  const normalized = message.replace(/\s+/gu, " ").trim().toLocaleLowerCase("tr");

  if (!normalized) {
    return false;
  }

  const hasDentalInformationSignal = [
    /di[şs](?:i|leri|ler)?\b/iu,
    /s[üu]t\s+di[şs]/iu,
    /kal[ıi]c[ıi]\s+di[şs]/iu,
    /az[ıi]\s+di[şs]/iu,
    /kesici/iu,
    /k[öo]pek\s+di[şs]/iu,
    /di[şs]\s+(?:ne zaman|takvimi|s[üu]rer|[çc][ıi]kar|d[üu][şs]er)/iu,
    /hangi\s+di[şs]/iu
  ].some((pattern) => pattern.test(normalized));

  if (!hasDentalInformationSignal) {
    return false;
  }

  const hasMarketplaceActionSignal = [
    /ikinci\s+el/iu,
    /ilan/iu,
    /arama/iu,
    /takip/iu,
    /kaydet/iu,
    /sat[ıi]n/iu,
    /almal[ıi]y[ıi]m/iu,
    /bakmal[ıi]y[ıi]m/iu,
    /ne\s+laz[ıi]m/iu,
    /hangi\s+(?:ür[üu]n|oyuncak|k[ıi]yafet|eşya)/iu,
    /di[şs]\s+ka[şs][ıi]y[ıi]c[ıi]/iu
  ].some((pattern) => pattern.test(normalized));

  return !hasMarketplaceActionSignal;
}

function dataFor<T>(results: ToolExecutionResult[], tool: AssistantToolName): T | null {
  const entry = results.find((candidate) => candidate.tool === tool);
  return entry?.result.ok ? entry.result.data as T : null;
}

function previewToolResult(tool: AssistantToolName, data: unknown): { tool: string; title: string; summary: string } | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  if (tool === "listing_search" && "results" in data && Array.isArray((data as { results?: unknown }).results)) {
    return {
      tool,
      title: "İlan arama",
      summary: `${(data as { results: unknown[] }).results.length} public ilan sonucu`
    };
  }

  if (tool === "listing_detail" && "detail" in data) {
    const detail = (data as { detail?: { title?: string } | null }).detail;
    return detail ? { tool, title: "İlan detayı", summary: detail.title ?? "Public ilan detayı" } : null;
  }

  if (tool === "buyer_question_templates" && "questions" in data && Array.isArray((data as { questions?: unknown }).questions)) {
    return {
      tool,
      title: "Alıcı soru şablonları",
      summary: `${(data as { questions: unknown[] }).questions.length} güvenli soru`
    };
  }

  if (tool === "listing_draft_helper") {
    return {
      tool,
      title: "İlan taslağı",
      summary: "Başlık, açıklama ve fotoğraf kontrol listesi taslağı"
    };
  }

  if (tool === "child_needs_recommendations" && "suggestedSearches" in data && Array.isArray((data as { suggestedSearches?: unknown }).suggestedSearches)) {
    return {
      tool,
      title: "Çocuk önerileri",
      summary: `${(data as { suggestedSearches: unknown[] }).suggestedSearches.length} yaş/mevsim önerisi`
    };
  }

  if (tool === "saved_search_suggest_draft" && "suggestedSearches" in data && Array.isArray((data as { suggestedSearches?: unknown }).suggestedSearches)) {
    return {
      tool,
      title: "Kayıtlı arama taslağı",
      summary: `${(data as { suggestedSearches: unknown[] }).suggestedSearches.length} taslak`
    };
  }

  if (tool === "category_lookup" && Array.isArray(data)) {
    return {
      tool,
      title: "Kategori önerileri",
      summary: `${data.length} kategori`
    };
  }

  if (tool === "seller_public_summary" && "seller" in data) {
    return {
      tool,
      title: "Satıcı public özeti",
      summary: "Private veri içermeyen satıcı özeti"
    };
  }

  if (tool === "rag_search" && Array.isArray(data)) {
    return {
      tool,
      title: "RAG kaynakları",
      summary: `${data.length} kaynak`
    };
  }

  return null;
}

function extractListingId(message: string): string | null {
  const match = /(?:listing|ilan)[-_\s:]?([a-z0-9-]{8,})/iu.exec(message) ?? /\b([0-9a-f]{8}-[0-9a-f-]{20,})\b/iu.exec(message);
  return match?.[1] ?? null;
}

function extractLooseProduct(message: string): string | null {
  const normalized = message.toLocaleLowerCase("tr");

  for (const term of ["bebek arabası", "oto koltuğu", "oyuncak", "mama sandalyesi", "park yatak", "beşik", "kıyafet"]) {
    if (normalized.includes(term)) {
      return term;
    }
  }

  return null;
}
