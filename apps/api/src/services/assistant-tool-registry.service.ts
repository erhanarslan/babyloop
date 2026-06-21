import { z } from "zod";
import type {
  AssistantListingSearchResult,
  AssistantToolContext,
  AssistantToolDefinition,
  AssistantToolResult
} from "./assistant-tools.types.js";
import type { RagSearchResult } from "./rag.types.js";

const categoryLookupInputSchema = z
  .object({
    query: z.string().trim().min(1).max(80)
  })
  .strict();

const ragSearchInputSchema = z
  .object({
    query: z.string().trim().min(1).max(1000),
    limit: z.number().int().min(1).max(10).optional()
  })
  .strict();

const listingSearchInputSchema = z
  .object({
    query: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(80).optional(),
    limit: z.number().int().min(1).max(10).optional()
  })
  .strict();

const childAgeBandInputSchema = z
  .object({
    ageMonths: z.number().int().min(0).max(96).optional(),
    ageBand: z.string().trim().min(1).max(40).optional()
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
  | "child_age_band_explain";

export class AssistantToolRegistry {
  private readonly tools = new Map<AssistantToolName, AssistantToolDefinition<unknown, unknown>>();

  constructor() {
    this.register(createRagSearchTool());
    this.register(createCategoryLookupTool());
    this.register(createListingSearchTool());
    this.register(createChildAgeBandExplainTool());
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

    return {
      ok: true,
      data: await tool.execute(context, parsed.data)
    };
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
    async execute(context, input) {
      if (!context.ragSearch) {
        return [];
      }

      return context.ragSearch(input.query, input.limit);
    }
  };
}

function createCategoryLookupTool(): AssistantToolDefinition<
  z.infer<typeof categoryLookupInputSchema>,
  Array<{ label: string; href: string }>
> {
  return {
    name: "category_lookup",
    description: "BabyLoop odaklı kategori önerilerini döndürür.",
    inputSchema: categoryLookupInputSchema,
    readOnly: true,
    async execute(_context, input) {
      const query = input.query.toLocaleLowerCase("tr");
      const matches = CATEGORY_GROUPS.filter((group) =>
        group.terms.some((term) => query.includes(term))
      );

      return (matches.length > 0 ? matches : CATEGORY_GROUPS.slice(0, 4)).map(({ label, href }) => ({
        label,
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

      return {
        available: true,
        results: await context.listingSearch({
          query: input.query,
          ...(input.city ? { city: input.city } : {}),
          ...(input.limit ? { limit: input.limit } : {})
        }),
        fallbackHref
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
    async execute(_context, input) {
      const ageBand = input.ageBand ?? deriveAgeBand(input.ageMonths);

      return explainAgeBand(ageBand);
    }
  };
}

function deriveAgeBand(ageMonths: number | undefined): string {
  if (ageMonths === undefined) {
    return "unknown";
  }

  if (ageMonths <= 3) return "newborn_0_3";
  if (ageMonths <= 6) return "infant_3_6";
  if (ageMonths <= 12) return "crawler_6_12";
  if (ageMonths <= 24) return "toddler_12_24";
  if (ageMonths <= 36) return "toddler_24_36";
  return "child_3_plus";
}

function explainAgeBand(ageBand: string): { label: string; explanation: string } {
  const explanations: Record<string, { label: string; explanation: string }> = {
    newborn_0_3: {
      label: "0-3 ay",
      explanation: "Taşıma, uyku, bakım ve yedek kıyafet hazırlıkları öne çıkar."
    },
    infant_3_6: {
      label: "3-6 ay",
      explanation: "Gündüz rutinleri, basit oyuncaklar ve dışarı çıkma hazırlıkları pratikleşir."
    },
    crawler_6_12: {
      label: "6-12 ay",
      explanation: "Ek gıda, emekleme alanı, kolay temizlenen ürünler ve güvenli oyuncaklar öne çıkar."
    },
    toddler_12_24: {
      label: "12-24 ay",
      explanation: "Yürüme, dışarı çantası, dayanıklı kıyafet ve yaşa uygun oyun ürünleri önem kazanır."
    },
    toddler_24_36: {
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
