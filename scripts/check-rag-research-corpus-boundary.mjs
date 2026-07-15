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

function mustNotContain(file, token) {
  const source = read(file);
  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}`);
  }
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

  const combined = requiredFiles.map((file) => read(file)).join("\n\n");
  const forbiddenClaims = [
    "kesin güvenlidir.",
    "doktor gerekmez",
    "şu ilacı ver",
    "kaç ml ver",
    "garanti güvenli",
    "alerji yapmaz"
  ];

  for (const claim of forbiddenClaims) {
    if (combined.toLocaleLowerCase("tr").includes(claim.toLocaleLowerCase("tr"))) {
      problems.push(`RAG corpus contains unsafe absolute/medical claim: ${claim}`);
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
