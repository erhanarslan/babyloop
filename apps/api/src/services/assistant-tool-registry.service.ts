import { z } from "zod";
import type {
  AssistantListingDetailSummary,
  AssistantListingSearchResult,
  AssistantSellerPublicSummary,
  AssistantToolContext,
  AssistantToolDefinition,
  AssistantToolResult
} from "./assistant-tools.types.js";
import type { RagSearchResult } from "./rag.types.js";
import { buildChildNeedDraft, type AssistantChildNeedDraft } from "./assistant-child-personalization.service.js";

const categoryLookupInputSchema = z
  .object({
    query: z.string().trim().min(1).max(80)
  })
  .strict();

const ragSearchInputSchema = z
  .object({
    query: z.string().trim().min(1).max(1000),
    limit: z.number().int().min(1).max(10).optional(),
    allowedSourcePaths: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
    allowedTopics: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    forbiddenSourcePaths: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
    forbiddenTopics: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    minimumReliability: z.string().trim().min(1).max(80).optional(),
    requiredOwner: z.string().trim().min(1).max(120).optional(),
    requireCanonicalOwner: z.boolean().optional(),
    minSourceCoverage: z.number().int().min(1).max(5).optional(),
    minFinalScore: z.number().min(0).max(1).optional(),
    minScoreMargin: z.number().min(0).max(1).optional(),
    maxChunksPerDocument: z.number().int().min(1).max(5).optional()
  })
  .strict();

const listingSearchInputSchema = z
  .object({
    query: z.string().trim().min(1).max(120),
    categoryId: z.string().trim().min(1).max(80).optional(),
    city: z.string().trim().min(1).max(80).optional(),
    condition: z.string().trim().min(1).max(40).optional(),
    limit: z.number().int().min(1).max(10).optional()
  })
  .strict();

const listingDetailInputSchema = z
  .object({
    listingId: z.string().trim().min(1).max(120)
  })
  .strict();

const childAgeBandInputSchema = z
  .object({
    ageMonths: z.number().int().min(0).max(96).optional(),
    ageBand: z.string().trim().min(1).max(40).optional()
  })
  .strict();

const childNeedsRecommendationsInputSchema = z
  .object({
    query: z.string().trim().min(1).max(160),
    city: z.string().trim().min(1).max(80).optional(),
    ageBand: z.string().trim().min(1).max(40).optional(),
    ageSignal: z.string().trim().min(1).max(40).optional(),
    productTerms: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
    season: z.string().trim().min(1).max(40).optional()
  })
  .strict();

const buyerQuestionTemplatesInputSchema = z
  .object({
    productType: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().min(1).max(80).optional()
  })
  .strict();

const listingDraftHelperInputSchema = z
  .object({
    productType: z.string().trim().min(1).max(80),
    condition: z.string().trim().min(1).max(40).optional(),
    notes: z.string().trim().max(500).optional()
  })
  .strict();

const savedSearchSuggestDraftInputSchema = z
  .object({
    query: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(80).optional(),
    ageSignal: z.string().trim().min(1).max(40).optional(),
    productTerms: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
    season: z.string().trim().min(1).max(40).optional()
  })
  .strict();

const sellerPublicSummaryInputSchema = z
  .object({
    listingId: z.string().trim().min(1).max(120).optional(),
    profileId: z.string().trim().min(1).max(120).optional()
  })
  .strict();

const CATEGORY_GROUPS = [
  { label: "Bebek arabası", href: "/browse?q=bebek%20arabas%C4%B1", terms: ["bebek arabası", "puset", "seyahat"] },
  { label: "Oto koltuğu", href: "/browse?q=oto%20koltu%C4%9Fu", terms: ["oto koltuğu", "araba koltuğu"] },
  { label: "Beslenme", href: "/browse?q=mama%20sandalyesi", terms: ["mama", "beslenme", "önlük"] },
  { label: "Oyuncak", href: "/browse?q=oyuncak", terms: ["oyuncak", "kitap", "montessori"] },
  { label: "Bebek giyim", href: "/browse?q=bebek%20giyim", terms: ["giyim", "kıyafet", "tekstil"] },
  { label: "Ücretsiz", href: "/browse?q=%C3%BCcretsiz", terms: ["ücretsiz", "bağış", "takas"] }
];

export type AssistantToolName =
  | "rag_search"
  | "category_lookup"
  | "listing_search"
  | "listing_detail"
  | "child_age_band_explain"
  | "child_needs_recommendations"
  | "buyer_question_templates"
  | "listing_draft_helper"
  | "saved_search_suggest_draft"
  | "seller_public_summary";

export class AssistantToolRegistry {
  private readonly tools = new Map<AssistantToolName, AssistantToolDefinition<unknown, unknown>>();

  constructor() {
    this.register(createRagSearchTool());
    this.register(createCategoryLookupTool());
    this.register(createListingSearchTool());
    this.register(createListingDetailTool());
    this.register(createChildAgeBandExplainTool());
    this.register(createChildNeedsRecommendationsTool());
    this.register(createBuyerQuestionTemplatesTool());
    this.register(createListingDraftHelperTool());
    this.register(createSavedSearchSuggestDraftTool());
    this.register(createSellerPublicSummaryTool());
  }

  list(): Array<AssistantToolDefinition<unknown, unknown>> {
    return [...this.tools.values()];
  }

  get(name: AssistantToolName): AssistantToolDefinition<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  async execute(
    name: AssistantToolName,
    context: AssistantToolContext,
    input: unknown
  ): Promise<AssistantToolResult<unknown>> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        ok: false,
        code: "TOOL_UNAVAILABLE",
        message: "Araç kullanılamıyor."
      };
    }

    const parsed = tool.inputSchema.safeParse(input);

    if (!parsed.success) {
      return {
        ok: false,
        code: "INVALID_TOOL_INPUT",
        message: "Araç girdisi geçersiz."
      };
    }

    try {
      return {
        ok: true,
        data: await tool.execute(context, parsed.data)
      };
    } catch {
      return {
        ok: false,
        code: "TOOL_UNAVAILABLE",
        message: "Araç çalıştırılamadı."
      };
    }
  }

  private register(tool: AssistantToolDefinition<unknown, unknown>): void {
    this.tools.set(tool.name as AssistantToolName, tool);
  }
}

function createRagSearchTool(): AssistantToolDefinition<z.infer<typeof ragSearchInputSchema>, RagSearchResult[]> {
  return {
    name: "rag_search",
    description: "BabyLoop bilgi tabanında kaynaklı, read-only arama yapar.",
    inputSchema: ragSearchInputSchema,
    readOnly: true,
    riskLevel: "low",
    category: "rag",
    returnsPrivateData: false,
    async execute(context, input) {
      if (!context.ragSearch) {
        return [];
      }

      return context.ragSearch(input.query, input.limit, {
        ...(input.allowedSourcePaths ? { allowedSourcePaths: input.allowedSourcePaths } : {}),
        ...(input.allowedTopics ? { allowedTopics: input.allowedTopics } : {}),
        ...(input.forbiddenSourcePaths ? { forbiddenSourcePaths: input.forbiddenSourcePaths } : {}),
        ...(input.forbiddenTopics ? { forbiddenTopics: input.forbiddenTopics } : {}),
        ...(input.minimumReliability ? { minimumReliability: input.minimumReliability } : {}),
        ...(input.requiredOwner ? { requiredOwner: input.requiredOwner } : {}),
        ...(input.requireCanonicalOwner !== undefined ? { requireCanonicalOwner: input.requireCanonicalOwner } : {}),
        ...(input.minSourceCoverage ? { minSourceCoverage: input.minSourceCoverage } : {}),
        ...(input.minFinalScore !== undefined ? { minFinalScore: input.minFinalScore } : {}),
        ...(input.minScoreMargin !== undefined ? { minScoreMargin: input.minScoreMargin } : {}),
        ...(input.maxChunksPerDocument ? { maxChunksPerDocument: input.maxChunksPerDocument } : {})
      });
    }
  };
}

function createCategoryLookupTool(): AssistantToolDefinition<
  z.infer<typeof categoryLookupInputSchema>,
  Array<{ categoryId: string; label: string; aliases: string[]; relatedCategories: string[]; href: string }>
> {
  return {
    name: "category_lookup",
    description: "BabyLoop odaklı kategori önerilerini döndürür.",
    inputSchema: categoryLookupInputSchema,
    readOnly: true,
    riskLevel: "low",
    category: "category",
    returnsPrivateData: false,
    async execute(_context, input) {
      const query = input.query.toLocaleLowerCase("tr");
      const matches = CATEGORY_GROUPS.filter((group) =>
        group.terms.some((term) => query.includes(term))
      );

      return (matches.length > 0 ? matches : CATEGORY_GROUPS.slice(0, 4)).map(({ label, href, terms }) => ({
        categoryId: slugifyLabel(label),
        label,
        aliases: terms,
        relatedCategories: CATEGORY_GROUPS
          .filter((group) => group.label !== label)
          .slice(0, 3)
          .map((group) => group.label),
        href
      }));
    }
  };
}

function createListingSearchTool(): AssistantToolDefinition<
  z.infer<typeof listingSearchInputSchema>,
  { available: boolean; results: AssistantListingSearchResult[]; fallbackHref: string }
> {
  return {
    name: "listing_search",
    description: "Uygunsa BabyLoop public listing araması yapar. Bu phase'de yalnızca read-only çalışır.",
    inputSchema: listingSearchInputSchema,
    readOnly: true,
    riskLevel: "low",
    category: "listing",
    returnsPrivateData: false,
    async execute(context, input) {
      const params = new URLSearchParams({ q: input.query });

      if (input.city) {
        params.set("city", input.city);
      }

      const fallbackHref = `/browse?${params.toString()}`;

      if (!context.listingSearch) {
        return {
          available: false,
          results: [],
          fallbackHref
        };
      }

      const results = await context.listingSearch({
        query: input.query,
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.city ? { city: input.city } : {}),
        ...(input.condition ? { condition: input.condition } : {}),
        ...(input.limit ? { limit: input.limit } : {})
      });

      return {
        available: true,
        results: results.map(sanitizeListingSearchResult),
        fallbackHref
      };
    }
  };
}

function createListingDetailTool(): AssistantToolDefinition<
  z.infer<typeof listingDetailInputSchema>,
  { available: boolean; detail: AssistantListingDetailSummary | null }
> {
  return {
    name: "listing_detail",
    description: "Public-safe ilan detay özetini döndürür.",
    inputSchema: listingDetailInputSchema,
    readOnly: true,
    riskLevel: "low",
    category: "listing",
    returnsPrivateData: false,
    async execute(context, input) {
      if (!context.listingDetail) {
        return {
          available: false,
          detail: null
        };
      }

      return {
        available: true,
        detail: sanitizeListingDetail(await context.listingDetail({ listingId: input.listingId }))
      };
    }
  };
}

function createChildAgeBandExplainTool(): AssistantToolDefinition<
  z.infer<typeof childAgeBandInputSchema>,
  { label: string; explanation: string }
> {
  return {
    name: "child_age_band_explain",
    description: "Yaş ayı veya ageBand değerini genel ürün ihtiyacı diliyle açıklar.",
    inputSchema: childAgeBandInputSchema,
    readOnly: true,
    riskLevel: "low",
    category: "safety",
    returnsPrivateData: false,
    async execute(_context, input) {
      const ageBand = normalizeAgeBand(input.ageBand ?? deriveAgeBand(input.ageMonths));

      return explainAgeBand(ageBand);
    }
  };
}

function createChildNeedsRecommendationsTool(): AssistantToolDefinition<
  z.infer<typeof childNeedsRecommendationsInputSchema>,
  AssistantChildNeedDraft
> {
  return {
    name: "child_needs_recommendations",
    description: "Aktif çocuk profili, ageBand ve mevsime göre read-only ihtiyaç ve kayıtlı arama taslakları üretir.",
    inputSchema: childNeedsRecommendationsInputSchema,
    readOnly: true,
    draftOnly: true,
    riskLevel: "medium",
    category: "draft",
    returnsPrivateData: false,
    async execute(context, input) {
      return buildChildNeedDraft({
        context: context.childPersonalization ?? null,
        query: input.query,
        ...(input.city ? { city: input.city } : {}),
        ...(input.ageBand ? { ageBand: input.ageBand } : {}),
        ...(input.ageSignal ? { ageSignal: input.ageSignal } : {}),
        ...(input.productTerms?.length ? { productTerms: input.productTerms } : {}),
        ...(input.season ? { season: input.season } : {})
      });
    }
  };
}

function createBuyerQuestionTemplatesTool(): AssistantToolDefinition<
  z.infer<typeof buyerQuestionTemplatesInputSchema>,
  { topic: string; questions: string[]; sources: Array<{ title: string; sourcePath: string; topic: string }> }
> {
  return {
    name: "buyer_question_templates",
    description: "Alıcı için güvenli satıcı soru şablonları üretir.",
    inputSchema: buyerQuestionTemplatesInputSchema,
    readOnly: true,
    draftOnly: true,
    riskLevel: "low",
    category: "safety",
    returnsPrivateData: false,
    async execute(_context, input) {
      const topic = normalizeProduct(input.productType ?? input.category ?? "ürün");
      const questions = [
        "Ürünün kaç yıldır kullanıldığını paylaşabilir misiniz?",
        "Eksik parçası, kırığı, onarım geçmişi veya belirgin hasarı var mı?",
        "Güncel ve farklı açılardan fotoğraf paylaşabilir misiniz?",
        topic.includes("oto koltuğu")
          ? "Oto koltuğu daha önce kaza veya sert darbe gördü mü?"
          : "Teslimden önce ürünün çalışır ve temiz durumda olduğunu birlikte kontrol edebilir miyiz?"
      ];

      return {
        topic,
        questions,
        sources: [
          {
            title: "Alıcı soru şablonları",
            sourcePath: "docs/rag/14-buyer-question-templates.md",
            topic: "buyer-questions"
          }
        ]
      };
    }
  };
}

function createListingDraftHelperTool(): AssistantToolDefinition<
  z.infer<typeof listingDraftHelperInputSchema>,
  { titleSuggestions: string[]; descriptionDraft: string; photoChecklist: string[]; safetyNotes: string[] }
> {
  return {
    name: "listing_draft_helper",
    description: "İlan başlığı ve açıklaması için draft-only öneri üretir.",
    inputSchema: listingDraftHelperInputSchema,
    readOnly: false,
    draftOnly: true,
    riskLevel: "medium",
    category: "draft",
    returnsPrivateData: false,
    async execute(_context, input) {
      const product = normalizeProduct(input.productType);
      const condition = input.condition ?? "durumu belirtilmeli";
      const notes = input.notes ? ` Not: ${input.notes}` : "";

      return {
        titleSuggestions: [
          `Temiz ${product}`,
          `${condition} durumda ${product}`,
          `Az kullanılmış ${product}`
        ],
        descriptionDraft: `${product} için kısa, net ve kontrol edilebilir bir ilan taslağı: Ürünün genel durumu ${condition}. Kullanım süresi, varsa eksik parça veya onarım geçmişi açıklanmalı.${notes} Teslimden önce fotoğraflar ve ürün durumu alıcıyla netleştirilebilir.`,
        photoChecklist: [
          "Ürünün tamamını gösteren net fotoğraf",
          "Yakın plan kondisyon fotoğrafı",
          "Etiket, model veya ölçü bilgisi varsa ayrı fotoğraf",
          "Varsa kusur veya eksik parçayı gösteren fotoğraf"
        ],
        safetyNotes: [
          "Kesin güvenlik veya sağlık garantisi verme.",
          "Kullanım geçmişini ve bilinen kusurları açık yaz.",
          "Telefon, e-posta veya açık adres paylaşmadan BabyLoop mesajlaşmasını kullan."
        ]
      };
    }
  };
}

function createSavedSearchSuggestDraftTool(): AssistantToolDefinition<
  z.infer<typeof savedSearchSuggestDraftInputSchema>,
  { suggestedSearches: Array<{ label: string; query: string; filters: Record<string, string>; reason: string }>; note: string }
> {
  return {
    name: "saved_search_suggest_draft",
    description: "Kayıtlı arama için taslak öneriler üretir; gerçek kayıt oluşturmaz.",
    inputSchema: savedSearchSuggestDraftInputSchema,
    readOnly: false,
    draftOnly: true,
    riskLevel: "medium",
    category: "draft",
    returnsPrivateData: false,
    async execute(context, input) {
      const childDraft = buildChildNeedDraft({
        context: context.childPersonalization ?? null,
        query: input.query,
        ...(input.city ? { city: input.city } : {}),
        ...(input.ageSignal ? { ageSignal: input.ageSignal } : {}),
        ...(input.productTerms?.length ? { productTerms: input.productTerms } : {}),
        ...(input.season ? { season: input.season } : {})
      });
      const terms = uniqueTerms([
        ...(input.productTerms?.length ? input.productTerms : [input.query]),
        ...childDraft.suggestedSearches.map((item) => item.query)
      ]);
      const city = input.city;

      return {
        suggestedSearches: terms.slice(0, 5).map((term) => ({
          label: city ? `${term} · ${city}` : term,
          query: term,
          filters: {
            ...(city ? { city } : {}),
            ...(input.ageSignal ? { age: input.ageSignal } : {}),
            ...(childDraft.ageBand ? { ageBand: childDraft.ageBand } : {}),
            season: childDraft.season
          },
          reason: childDraft.hasChildContext
            ? `${childDraft.childLabel} profiline ve ${childDraft.seasonLabel.toLocaleLowerCase("tr")} dönemine göre takip edilebilir.`
            : "Bu taslak, ihtiyacı tekrar aramak yerine uygun ilanları takip etmeyi kolaylaştırır."
        })),
        note: "Bu sadece taslaktır; kullanıcı onayı olmadan kayıtlı arama oluşturulmaz."
      };
    }
  };
}

function createSellerPublicSummaryTool(): AssistantToolDefinition<
  z.infer<typeof sellerPublicSummaryInputSchema>,
  { available: boolean; seller: AssistantSellerPublicSummary | null }
> {
  return {
    name: "seller_public_summary",
    description: "Satıcı için public-safe özet döndürür.",
    inputSchema: sellerPublicSummaryInputSchema,
    readOnly: true,
    riskLevel: "low",
    category: "seller",
    returnsPrivateData: false,
    async execute(context, input) {
      if (!context.sellerPublicSummary || (!input.listingId && !input.profileId)) {
        return {
          available: false,
          seller: null
        };
      }

      return {
        available: true,
        seller: sanitizeSellerPublicSummary(
          await context.sellerPublicSummary(toSellerPublicSummaryInput(input))
        )
      };
    }
  };
}

function sanitizeListingSearchResult(result: AssistantListingSearchResult): AssistantListingSearchResult {
  return {
    listingId: result.listingId,
    title: result.title,
    href: result.href,
    ...(result.category ? { category: result.category } : {}),
    ...(result.condition ? { condition: result.condition } : {}),
    ...(result.imageUrl ? { imageUrl: result.imageUrl } : {}),
    ...(result.price ? { price: result.price } : {}),
    ...(result.currency ? { currency: result.currency } : {}),
    ...(result.city ? { city: result.city } : {}),
    ...(result.status ? { status: result.status } : {})
  };
}

function sanitizeListingDetail(result: AssistantListingDetailSummary | null): AssistantListingDetailSummary | null {
  if (!result) {
    return null;
  }

  return {
    listingId: result.listingId,
    title: result.title,
    href: result.href,
    imageCount: result.imageCount,
    ...(result.descriptionPreview ? { descriptionPreview: result.descriptionPreview } : {}),
    ...(result.price ? { price: result.price } : {}),
    ...(result.currency ? { currency: result.currency } : {}),
    ...(result.category ? { category: result.category } : {}),
    ...(result.condition ? { condition: result.condition } : {}),
    ...(result.city ? { city: result.city } : {}),
    ...(result.status ? { status: result.status } : {}),
    ...(result.safeSellerSummary
      ? {
          safeSellerSummary: {
            ...(result.safeSellerSummary.displayName ? { displayName: result.safeSellerSummary.displayName } : {}),
            ...(result.safeSellerSummary.city ? { city: result.safeSellerSummary.city } : {})
          }
        }
      : {})
  };
}

function sanitizeSellerPublicSummary(result: AssistantSellerPublicSummary | null): AssistantSellerPublicSummary | null {
  if (!result) {
    return null;
  }

  return {
    ...(result.displayName ? { displayName: result.displayName } : {}),
    ...(result.city ? { city: result.city } : {}),
    ...(result.activeListingCount !== undefined ? { activeListingCount: result.activeListingCount } : {}),
    ...(result.memberSince ? { memberSince: result.memberSince } : {}),
    ...(result.publicTrustHints?.length ? { publicTrustHints: result.publicTrustHints.slice(0, 5) } : {})
  };
}

function deriveAgeBand(ageMonths: number | undefined): string {
  if (ageMonths === undefined) {
    return "unknown";
  }

  if (ageMonths <= 3) return "newborn_0_3";
  if (ageMonths <= 6) return "infant_3_6";
  if (ageMonths <= 12) return "infant_6_12";
  if (ageMonths <= 24) return "toddler_12_24";
  if (ageMonths <= 36) return "preschool_24_36";
  return "child_3_plus";
}

function normalizeAgeBand(ageBand: string): string {
  const aliases: Record<string, string> = {
    crawler_6_12: "infant_6_12",
    toddler_24_36: "preschool_24_36"
  };

  return aliases[ageBand] ?? ageBand;
}

function explainAgeBand(ageBand: string): { label: string; explanation: string } {
  const explanations: Record<string, { label: string; explanation: string }> = {
    expecting: {
      label: "Bekleniyor",
      explanation: "Doğum öncesi hazırlıkta temel bakım, taşıma, uyku ve ilk kıyafet ihtiyaçları planlanabilir."
    },
    newborn_0_3: {
      label: "0-3 ay",
      explanation: "Taşıma, uyku, bakım ve yedek kıyafet hazırlıkları öne çıkar."
    },
    infant_3_6: {
      label: "3-6 ay",
      explanation: "Gündüz rutinleri, basit oyuncaklar ve dışarı çıkma hazırlıkları pratikleşir."
    },
    infant_6_12: {
      label: "6-12 ay",
      explanation: "Ek gıda, emekleme alanı, kolay temizlenen ürünler ve güvenli oyuncaklar öne çıkar."
    },
    toddler_12_24: {
      label: "12-24 ay",
      explanation: "Yürüme, dışarı çantası, dayanıklı kıyafet ve yaşa uygun oyun ürünleri önem kazanır."
    },
    preschool_24_36: {
      label: "24-36 ay",
      explanation: "Bağımsızlık, paylaşma, uyku rutini ve daha dayanıklı oyun ürünleri gündeme gelir."
    },
    child_3_plus: {
      label: "3 yaş ve üzeri",
      explanation: "Daha uzun süre kullanılabilecek oyuncak, kitap, kıyafet ve dışarı ekipmanları düşünülebilir."
    }
  };

  return explanations[ageBand] ?? {
    label: "Yaş bilgisi yok",
    explanation: "Genel ürün ihtiyacı için yaş ayı veya dönem bilgisi yardımcı olur."
  };
}

function slugifyLabel(label: string): string {
  return label
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ı/gu, "i")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function normalizeProduct(value: string): string {
  return value.trim().toLocaleLowerCase("tr") || "ürün";
}


function toSellerPublicSummaryInput(input: {
  listingId?: string | undefined;
  profileId?: string | undefined;
}): { listingId?: string; profileId?: string } {
  const result: { listingId?: string; profileId?: string } = {};

  const listingId = typeof input.listingId === "string" ? input.listingId.trim() : "";
  if (listingId.length > 0) {
    result.listingId = listingId;
  }

  const profileId = typeof input.profileId === "string" ? input.profileId.trim() : "";
  if (profileId.length > 0) {
    result.profileId = profileId;
  }

  return result;
}


function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.replace(/\s+/gu, " ").trim();
    const key = normalized.toLocaleLowerCase("tr");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}
