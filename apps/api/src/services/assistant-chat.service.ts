import type {
  AssistantChatBody,
  AssistantMode
} from "../schemas/assistant.schemas.js";

export const ASSISTANT_CHAT_PROMPT_VERSION = "assistant-chat-v1";
export const ASSISTANT_CHAT_PROVIDER_NAME = "curated-assistant";

export type AssistantTopic = {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  stageLabel: string;
  commonMisconception: string;
  guidance: string;
  browseHref: string;
};

export type AssistantAction = {
  href: string;
  label: string;
};

export type AssistantChatReply = {
  mode: AssistantMode;
  content: string;
  topic?: AssistantTopic;
  actions: AssistantAction[];
  safetyDisclaimers: string[];
  providerName: typeof ASSISTANT_CHAT_PROVIDER_NAME;
  promptVersion: typeof ASSISTANT_CHAT_PROMPT_VERSION;
  confidenceScore: number;
};

const NEWBORN_TOPIC: AssistantTopic = {
  id: "newborn-first-needs",
  title: "İlk aylar için temel ihtiyaçlar",
  eyebrow: "0-3 ay",
  summary: "İlk haftaları sade planlamak isteyen ebeveynler için kısa ihtiyaç özeti.",
  stageLabel: "Yenidoğan dönemi",
  commonMisconception: "Her şey doğumdan önce sıfır alınmalı.",
  guidance:
    "Acil olmayan ürünleri zamana yay; güvenlik açısından kritik ürünlerde eksik parça, hijyen ve mevcut durumu dikkatle kontrol et.",
  browseHref: "/browse?q=yenidoğan&sort=newest"
};

const GEAR_SAFETY_TOPIC: AssistantTopic = {
  id: "baby-gear-safety",
  title: "İkinci el bebek ürünlerinde kontrol",
  eyebrow: "Alışveriş kontrolü",
  summary: "Bebek arabası, taşıyıcı, mama sandalyesi ve benzeri ürünler için kısa kontrol listesi.",
  stageLabel: "Ürün kontrolü",
  commonMisconception: "Fotoğrafta temiz görünüyorsa otomatik olarak güvenlidir.",
  guidance:
    "Ürünün kullanım geçmişini, eksik parçasını, dengesini, hareketli mekanizmalarını, kumaş durumunu ve ek fotoğraf olup olmadığını sor.",
  browseHref: "/browse?hasImages=true&sort=newest"
};

const SIX_TO_TWELVE_TOPIC: AssistantTopic = {
  id: "six-to-twelve-months",
  title: "6-12 ay keşif listesi",
  eyebrow: "6-12 ay",
  summary: "Oturma, keşif, beslenme ve hareketin arttığı dönem için pratik kategori özeti.",
  stageLabel: "Keşif dönemi",
  commonMisconception: "Daha çok oyuncak her zaman daha iyi gelişim demektir.",
  guidance:
    "Yaşa uygun, kolay temizlenen ve güvenli az sayıda ürün çoğu zaman çok sayıda benzer üründen daha faydalıdır.",
  browseHref: "/browse?q=6-12 ay&sort=newest"
};

const TODDLER_TOPIC: AssistantTopic = {
  id: "toddler-mobility",
  title: "12-24 ay hareket ve oyun",
  eyebrow: "12-24 ay",
  summary: "Hareket, dışarı çıkma, oyuncak, kıyafet ve günlük rutinler için kısa özet.",
  stageLabel: "Hareket dönemi",
  commonMisconception: "Bu dönemde sadece oyuncak gerekir; rutin ürünleri çok önemli değildir.",
  guidance:
    "Mevsime uygun kıyafet, beslenme yardımcısı ve güvenli aktivite oyuncakları büyük ürünler kadar işe yarayabilir.",
  browseHref: "/browse?q=12-24 ay&sort=newest"
};

const PRESCHOOL_TOPIC: AssistantTopic = {
  id: "preschool-practical-needs",
  title: "24-36 ay pratik ihtiyaçlar",
  eyebrow: "24-36 ay",
  summary: "Kıyafet, oyun, seyahat ve rutinleri planlamak için kısa rehber.",
  stageLabel: "Okul öncesi hazırlık",
  commonMisconception: "Çocuk büyüdükçe ikinci el ürün kontrolü daha az önemlidir.",
  guidance:
    "Bu dönemde ihtiyaçlar hızlı değişir. Kayıtlı aramalar beden, sezon ve kategori takibini kolaylaştırabilir.",
  browseHref: "/browse?q=24-36 ay&sort=newest"
};

const ASSISTANT_TOPICS = [
  NEWBORN_TOPIC,
  GEAR_SAFETY_TOPIC,
  SIX_TO_TWELVE_TOPIC,
  TODDLER_TOPIC,
  PRESCHOOL_TOPIC
];

const SAFETY_DISCLAIMERS = [
  "BabyLoop Asistan tanı, tedavi, ilaç, terapi veya beslenme planı vermez.",
  "Gereksiz özel iletişim bilgisi veya hassas çocuk bilgisi paylaşma.",
  "Güvenlik açısından önemli ürünlerde kullanım öncesi durumu, eksik parçaları ve ürün geçmişini kontrol et."
];

export function createAssistantChatReply(input: AssistantChatBody): AssistantChatReply {
  const topic = findRelevantTopic(input.content, input.mode);

  switch (input.mode) {
    case "find_products":
      return buildReply({
        mode: input.mode,
        content:
          "En yakın kategoriyle başla, fotoğraflı ilanları öne al ve bu ihtiyaç yakında olacaksa aramayı kaydet. Satıcıya yazmadan önce ürün durumu, eksik parça ve teslim bilgisini sorman iyi olur.",
        topic,
        actions: [
          { href: topic?.browseHref ?? "/browse?hasImages=true&sort=newest", label: "İlanlara bak" },
          { href: "/account/saved-searches", label: "Kayıtlı aramalar" },
          { href: "/guides", label: "Ebeveyn rehberi" }
        ],
        confidenceScore: topic ? 0.82 : 0.68
      });

    case "sell_help":
      return buildReply({
        mode: input.mode,
        content:
          "Daha net bir ilan için ürün tipini, durumunu, eksik parçaları, aksesuarları, kullanım süresini, temiz fotoğrafları, teslim beklentisini ve fiyatın esnek olup olmadığını yaz.",
        topic,
        actions: [
          { href: "/sell", label: "İlan oluştur" },
          { href: "/account/seller", label: "Satıcı paneli" },
          { href: "/guides", label: "Ebeveyn rehberi" }
        ],
        confidenceScore: topic ? 0.8 : 0.7
      });

    case "age_needs":
      return buildReply({
        mode: input.mode,
        content:
          "Yaş dönemini kabaca düşünerek yaklaşan ihtiyaçları sade bir listeye çevirebilirsin. Kesin doğum günü gibi hassas bilgi vermeden kategori, rehber ve kayıtlı arama fikirleri oluşturabilirsin.",
        topic: topic ?? NEWBORN_TOPIC,
        actions: [
          { href: "/account/children", label: "Çocuğum" },
          { href: topic?.browseHref ?? "/browse?sort=newest", label: "İlanlara bak" },
          { href: "/guides", label: "Ebeveyn rehberi" }
        ],
        confidenceScore: topic ? 0.86 : 0.72
      });

    case "safe_buying":
      return buildReply({
        mode: input.mode,
        content:
          "İkinci el ürün almadan önce kullanım geçmişini, eksik parçaları, kusurları, temizlik ihtiyacını, dahil olan aksesuarları ve güvenlik sorunu yaşanıp yaşanmadığını sor. Oto koltuğu ve benzeri ürünlerde daha dikkatli ol.",
        topic: topic ?? GEAR_SAFETY_TOPIC,
        actions: [
          { href: "/guides", label: "Ebeveyn rehberi" },
          { href: "/browse?hasImages=true&sort=newest", label: "İlanlara bak" }
        ],
        confidenceScore: topic ? 0.9 : 0.78
      });

    case "platform_help":
      return buildReply({
        mode: input.mode,
        content:
          "Kategorilerden gezebilir, ilanları açabilir, faydalı aramaları kaydedebilir, Çocuğum alanıyla ihtiyaçları takip edebilir ve satıcılara BabyLoop içinden mesaj yazabilirsin.",
        topic: null,
        actions: [
          { href: "/browse", label: "İlanlara bak" },
          { href: "/account/children", label: "Çocuğum" },
          { href: "/sell", label: "İlan oluştur" }
        ],
        confidenceScore: 0.76
      });
  }
}

function buildReply({
  mode,
  content,
  topic,
  actions,
  confidenceScore
}: {
  mode: AssistantMode;
  content: string;
  topic: AssistantTopic | null;
  actions: AssistantAction[];
  confidenceScore: number;
}): AssistantChatReply {
  const baseReply: Omit<AssistantChatReply, "topic"> = {
    mode,
    content,
    actions,
    safetyDisclaimers: SAFETY_DISCLAIMERS,
    providerName: ASSISTANT_CHAT_PROVIDER_NAME,
    promptVersion: ASSISTANT_CHAT_PROMPT_VERSION,
    confidenceScore
  };

  return topic ? { ...baseReply, topic } : baseReply;
}

function findRelevantTopic(content: string, mode: AssistantMode): AssistantTopic | null {
  const normalizedContent = normalize(content);

  if (mode === "age_needs") {
    if (
      normalizedContent.includes("12") ||
      normalizedContent.includes("24") ||
      normalizedContent.includes("toddler")
    ) {
      return TODDLER_TOPIC;
    }

    if (normalizedContent.includes("6") || normalizedContent.includes("six")) {
      return SIX_TO_TWELVE_TOPIC;
    }

    if (
      normalizedContent.includes("newborn") ||
      normalizedContent.includes("0-3") ||
      normalizedContent.includes("first weeks")
    ) {
      return NEWBORN_TOPIC;
    }
  }

  if (
    normalizedContent.includes("safe") ||
    normalizedContent.includes("second-hand") ||
    normalizedContent.includes("second hand") ||
    normalizedContent.includes("gear") ||
    normalizedContent.includes("stroller") ||
    normalizedContent.includes("car seat") ||
    normalizedContent.includes("feeding chair")
  ) {
    return GEAR_SAFETY_TOPIC;
  }

  if (
    normalizedContent.includes("preschool") ||
    normalizedContent.includes("36") ||
    normalizedContent.includes("3+")
  ) {
    return PRESCHOOL_TOPIC;
  }

  return (
    ASSISTANT_TOPICS.find((topic) =>
      [topic.title, topic.summary, topic.eyebrow, topic.stageLabel]
        .join(" ")
        .toLowerCase()
        .split(/\s+/)
        .some((token) => token.length > 4 && normalizedContent.includes(token))
    ) ?? null
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
