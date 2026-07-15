import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "docs/rag/42-parent-question-inventory-dedup-map.md",
  "docs/rag/43-authoritative-source-map.md",
  "docs/rag/44-feeding-and-food-safety-canon.md",
  "docs/rag/45-safe-sleep-and-product-boundary-canon.md",
  "docs/rag/46-illness-red-flags-boundary-canon.md",
  "docs/rag/47-second-hand-product-safety-canon.md",
  "docs/rag/48-rag-answer-ownership-map.md"
];

const problems = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    problems.push(`Missing required RAG research corpus file: ${file}`);
  }
}

function read(file) {
  return readFileSync(file, "utf8");
}

function mustContain(file, token) {
  const source = read(file);
  if (!source.includes(token)) {
    problems.push(`${file} must contain ${JSON.stringify(token)}`);
  }
}

function buildAnswerClaimCorpus(files) {
  const excludedSectionHeadings = [
    "soru",
    "boundary",
    "yasak",
    "kaçınılacak",
    "riskli",
    "örnek",
    "forbidden",
    "cevaplanmayacak",
    "boundary sinyalleri",
    "retrieval routing",
    "yasak dil"
  ];

  const allowedNegationTokens = [
    "veremem",
    "veremez",
    "öneremem",
    "önermez",
    "onaylamaz",
    "değildir",
    "olmamalıdır",
    "kaçın",
    "yasak",
    "sınır",
    "boundary",
    "yerine geçmez",
    "yapmaz dememelidir",
    "BabyLoop hiçbir",
    "asla"
  ];

  const answerLines = [];

  for (const file of files) {
    let excludedSection = false;

    for (const rawLine of read(file).split("\n")) {
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      const heading = line.replace(/^#+\s*/u, "").toLocaleLowerCase("tr");

      if (line.startsWith("#")) {
        excludedSection = excludedSectionHeadings.some((token) => heading.includes(token));
        continue;
      }

      if (excludedSection) {
        continue;
      }

      if (/^[-*>#]*\s*(Soru|Boundary|Yasak|Riskli|Örnek|Forbidden|Boundary notu|Cevaplanmayacak|Boundary sinyalleri)/iu.test(line)) {
        continue;
      }

      if (/^[-*]\s*["“]/u.test(line)) {
        continue;
      }

      if (allowedNegationTokens.some((token) => line.includes(token))) {
        continue;
      }

      answerLines.push(`${file}: ${line}`);
    }
  }

  return answerLines.join("\n");
}

if (problems.length === 0) {
  mustContain("docs/rag/42-parent-question-inventory-dedup-map.md", "Canonical soru aileleri");
  mustContain("docs/rag/42-parent-question-inventory-dedup-map.md", "Çakışan soru yönetimi");
  mustContain("docs/rag/42-parent-question-inventory-dedup-map.md", "6 aylık bebek ne yer?");
  mustContain("docs/rag/42-parent-question-inventory-dedup-map.md", "Oto koltuğu ikinci el alınır mı?");
  mustContain("docs/rag/42-parent-question-inventory-dedup-map.md", "Ateşi var ne yapayım?");

  mustContain("docs/rag/43-authoritative-source-map.md", "CDC");
  mustContain("docs/rag/43-authoritative-source-map.md", "WHO");
  mustContain("docs/rag/43-authoritative-source-map.md", "Türkiye HSGM");
  mustContain("docs/rag/43-authoritative-source-map.md", "NHTSA");
  mustContain("docs/rag/43-authoritative-source-map.md", "CPSC");
  mustContain("docs/rag/43-authoritative-source-map.md", "official-referenced");

  mustContain("docs/rag/44-feeding-and-food-safety-canon.md", "4 aydan önce");
  mustContain("docs/rag/44-feeding-and-food-safety-canon.md", "12 aydan küçük bebeklere bal verilmemelidir");
  mustContain("docs/rag/44-feeding-and-food-safety-canon.md", "kişiselleştirilmiş diyet");
  mustContain("docs/rag/44-feeding-and-food-safety-canon.md", "boğulma riski");

  mustContain("docs/rag/45-safe-sleep-and-product-boundary-canon.md", "sırtüstü");
  mustContain("docs/rag/45-safe-sleep-and-product-boundary-canon.md", "sert, düz");
  mustContain("docs/rag/45-safe-sleep-and-product-boundary-canon.md", "Ana kucağı");
  mustContain("docs/rag/45-safe-sleep-and-product-boundary-canon.md", "kesin güvenli");

  mustContain("docs/rag/46-illness-red-flags-boundary-canon.md", "İlaç adı veya doz veremem");
  mustContain("docs/rag/46-illness-red-flags-boundary-canon.md", "3 aydan küçük");
  mustContain("docs/rag/46-illness-red-flags-boundary-canon.md", "nefes almada zorlanma");
  mustContain("docs/rag/46-illness-red-flags-boundary-canon.md", "Diş çıkarma");

  mustContain("docs/rag/47-second-hand-product-safety-canon.md", "Geri çağırma");
  mustContain("docs/rag/47-second-hand-product-safety-canon.md", "Oto koltuğu");
  mustContain("docs/rag/47-second-hand-product-safety-canon.md", "Temiz görünmesi tek başına yeterli değildir");
  mustContain("docs/rag/47-second-hand-product-safety-canon.md", "kesin güvenli");

  mustContain("docs/rag/48-rag-answer-ownership-map.md", "primary answer owner");
  mustContain("docs/rag/48-rag-answer-ownership-map.md", "Doküman çoğaltma yasağı");
  mustContain("docs/rag/48-rag-answer-ownership-map.md", "feeding-and-food-safety-canon");
  mustContain("docs/rag/48-rag-answer-ownership-map.md", "illness-red-flags-boundary-canon");

  for (const file of requiredFiles) {
    mustContain(file, "id:");
    mustContain(file, "title:");
    mustContain(file, "locale:");
    mustContain(file, "topic:");
    mustContain(file, "safetyScope:");
    mustContain(file, "sourceReliability:");
    mustContain(file, "version:");
  }

  const answerClaimCorpus = buildAnswerClaimCorpus(requiredFiles);

  const forbiddenAnswerPatterns = [
    { label: "absolute product safety guarantee", pattern: /kesin güvenlidir\.?/iu },
    { label: "doctor not needed claim", pattern: /doktor(?:a)? gerekmez\.?/iu },
    { label: "direct medication instruction", pattern: /(?:calpol|dolven|parasetamol|ibuprofen|antibiyotik)[^\n.]{0,60}(?:ver|kullan|başla)/iu },
    { label: "direct dosage instruction", pattern: /\b\d+(?:[,.]\d+)?\s*ml\s*(?:ver|kullan)/iu },
    { label: "allergy safety guarantee", pattern: /alerji yapmaz\.?/iu },
    { label: "no risk guarantee", pattern: /hiç risk yok\.?/iu }
  ];

  for (const { label, pattern } of forbiddenAnswerPatterns) {
    if (pattern.test(answerClaimCorpus)) {
      problems.push(`RAG corpus contains unsafe answer claim: ${label}`);
    }
  }
}

if (problems.length > 0) {
  console.error("RAG research corpus boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("RAG research corpus boundary passed.");
