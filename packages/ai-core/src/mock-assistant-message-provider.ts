import { ASSISTANT_MESSAGE_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  AssistantMessageInput,
  AssistantMessageOutput,
  AssistantMessageProvider
} from "./types.js";

const MOCK_PROVIDER_NAME = "mock-assistant-message";

export class MockAssistantMessageProvider implements AssistantMessageProvider {
  readonly providerName = MOCK_PROVIDER_NAME;

  async answerMessage(input: AssistantMessageInput): Promise<AssistantMessageOutput> {
    const message = input.message.trim().slice(0, 1000);

    return {
      answer: buildTurkishAnswer(message),
      actions: buildActions(message),
      providerName: this.providerName,
      promptVersion: ASSISTANT_MESSAGE_PROMPT_VERSION
    };
  }
}

export const mockAssistantMessageProvider = new MockAssistantMessageProvider();

function buildTurkishAnswer(message: string): string {
  const normalized = normalizeSearchText(message);

  if (includesAny(normalized, ["12 ay", "12 aylik", "1 yas", "bir yas"])) {
    return [
      "12 aylık dönemde hareket, güvenlik ve rutinler öne çıkar. Kısa bir kontrol listesi:",
      "",
      "- Evde sivri köşe, priz ve küçük parçaları kontrol et.",
      "- Yürümeye başladıysa ayakkabıdan çok güvenli zemin ve gözetim önemlidir.",
      "- Dışarı çıkarken yedek kıyafet, su, atıştırmalık ve sevdiği küçük bir oyuncak işini kolaylaştırır.",
      "- Uyku ve yemek rutinini mümkün olduğunca benzer saatlerde tutmaya çalış.",
      "- Ateş, belirgin halsizlik, nefes alma zorluğu veya uzun süren şikâyet varsa doktoruna danış."
    ].join("\n");
  }

  if (includesAny(normalized, ["gaz", "sanci", "sancı"])) {
    return [
      "Gaz sancısında amaç bebeği rahatlatmak ve seni de sakin tutmak. Kısaca şunları deneyebilirsin:",
      "",
      "- Beslenme sonrası gazını çıkarmak için biraz dik pozisyonda tut.",
      "- Karnına çok hafif, nazik dairesel masaj yapabilirsin.",
      "- Bacaklarını nazikçe bisiklet hareketi gibi oynatmak bazen rahatlatır.",
      "- Ağlama çok şiddetliyse, uzun sürüyorsa veya genel hali iyi değilse doktoruna danış."
    ].join("\n");
  }

  if (includesAny(normalized, ["sat", "ilan", "fiyat", "listele"])) {
    return [
      "Daha anlaşılır bir ilan için kısa ve net bilgi yeterli olur:",
      "",
      "- Başlıkta ürün tipi, marka veya ayırt edici özelliği yaz.",
      "- Açıklamada kullanım süresi, kondisyon, eksik parça ve teslim bilgisini belirt.",
      "- Net fotoğraflar ekle; aşınma veya leke varsa ayrıca göster.",
      "- Telefon, e-posta veya açık adres gibi özel bilgileri ilana yazma."
    ].join("\n");
  }

  if (includesAny(normalized, ["oto kolt", "bebek araba", "ikinci el", "guven", "güven"])) {
    return [
      "İkinci el bebek ürünlerinde ürünü görmeden karar vermemek iyi olur:",
      "",
      "- Eksik parça, kırık, gevşek mekanizma veya yoğun yıpranma var mı sor.",
      "- Oto koltuğu gibi güvenlik ürünlerinde kaza geçmişini ve kullanım süresini mutlaka öğren.",
      "- Ek fotoğraf istemekten çekinme.",
      "- Emin değilsen ürünü almadan önce üretici bilgilerini ve güvenlik uyarılarını kontrol et."
    ].join("\n");
  }

  return [
    "Sorunu kısa ve pratik şekilde ele alalım:",
    "",
    "- Önce ihtiyacı netleştir: ürün mü arıyorsun, günlük rutin mi planlıyorsun, yoksa ilan mı hazırlıyorsun?",
    "- Yaş, kullanım amacı ve bütçe gibi temel bilgileri düşün.",
    "- Güvenlik veya sağlıkla ilgili belirti varsa genel öneriyle yetinme; doktoruna danış.",
    "- İstersen sorunu biraz daha detaylandır, daha net bir cevap hazırlayayım."
  ].join("\n");
}

function buildActions(message: string): AssistantMessageOutput["actions"] {
  const normalized = normalizeSearchText(message);

  if (includesAny(normalized, ["sat", "ilan", "fiyat", "listele"])) {
    return [{ label: "İlan oluştur", href: "/sell" }];
  }

  if (includesAny(normalized, ["ara", "bul", "urun", "ürün", "oto kolt", "bebek araba"])) {
    return [{ label: "İlanlara bak", href: "/browse" }];
  }

  if (includesAny(normalized, ["ay", "yas", "yaş", "bebek", "cocuk", "çocuk", "gaz", "uyku"])) {
    return [{ label: "Ebeveyn rehberi", href: "/guides" }];
  }

  return [];
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(normalizeSearchText(needle)));
}
