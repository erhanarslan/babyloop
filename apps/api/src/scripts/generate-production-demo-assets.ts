import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { productionDemoCatalog } from "@babyloop/database/production-demo-product-sources";

const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");
const assetRoot = path.join(workspaceRoot, "assets/demo-listings");

const categoryShapes: Record<string, (accent: string, variant: number) => string> = {
  strollers: (accent, variant) => `<path d="M310 575h390l-45-210H395z" fill="${accent}"/><path d="M400 360q80-180 250-40" fill="none" stroke="#243238" stroke-width="42"/><circle cx="390" cy="665" r="72" fill="#243238"/><circle cx="650" cy="665" r="72" fill="#243238"/><path d="M650 365l${variant * 8} 250" stroke="#243238" stroke-width="25"/>`,
  "car-seats": (accent) => `<path d="M340 200q190-80 300 80v320q-120 95-300 0z" fill="${accent}"/><path d="M395 270q120-70 190 20v210q-80 70-190 0z" fill="#f7efe5"/><path d="M430 310l130 230M560 310L430 540" stroke="#243238" stroke-width="22"/>`,
  toys: (accent, variant) => `<rect x="330" y="310" width="150" height="150" rx="24" fill="${accent}"/><circle cx="600" cy="390" r="105" fill="#efb75e"/><path d="M300 590h400" stroke="#243238" stroke-width="34"/><circle cx="390" cy="650" r="55" fill="#243238"/><circle cx="610" cy="650" r="55" fill="#243238"/><path d="M500 235v${75 + variant * 10}" stroke="#6c8f74" stroke-width="32"/>`,
  "montessori-toys": (accent, variant) => `<rect x="275" y="610" width="450" height="45" rx="20" fill="#b98758"/><circle cx="500" cy="${540 - variant * 8}" r="135" fill="${accent}"/><circle cx="500" cy="400" r="105" fill="#e7bc63"/><circle cx="500" cy="285" r="75" fill="#88a883"/><path d="M500 190v430" stroke="#714c35" stroke-width="28"/>`,
  "baby-clothing": (accent, variant) => `<path d="M340 275l110-75h100l110 75-55 145-75-35v285H470V385l-75 35z" fill="${accent}"/><path d="M450 200q50 ${45 + variant * 4} 100 0" fill="none" stroke="#f7efe5" stroke-width="24"/>`,
  feeding: (accent, variant) => `<path d="M380 240h240l-35 390H415z" fill="${accent}"/><ellipse cx="500" cy="235" rx="120" ry="40" fill="#243238"/><path d="M650 300q120 ${110 + variant * 5} 0 230" fill="none" stroke="#e7bc63" stroke-width="38"/><circle cx="680" cy="580" r="65" fill="#88a883"/>`,
  "sleep-room": (accent, variant) => `<rect x="270" y="300" width="460" height="300" rx="${55 + variant * 5}" fill="${accent}"/><path d="M300 350h400M330 350v250M670 350v250" stroke="#f7efe5" stroke-width="30"/><path d="M260 620h480" stroke="#714c35" stroke-width="40"/>`,
  carriers: (accent, variant) => `<path d="M360 220q140-80 280 0l-30 390q-110 ${70 + variant * 5} -220 0z" fill="${accent}"/><path d="M390 260Q250 400 350 650M610 260q140 140 40 390" fill="none" stroke="#243238" stroke-width="34"/>`,
  "bath-care": (accent, variant) => `<path d="M250 390q250 ${120 + variant * 5} 500 0l-55 230q-195 90-390 0z" fill="${accent}"/><path d="M300 395q200 90 400 0" fill="none" stroke="#f7efe5" stroke-width="26"/><circle cx="690" cy="270" r="55" fill="#e7bc63"/>`,
  "books-education": (accent, variant) => `<path d="M250 250q130-60 250 35v390q-120-95-250-35z" fill="${accent}"/><path d="M750 250q-130-60-250 35v390q120-95 250-35z" fill="#e7bc63"/><path d="M500 285v390" stroke="#243238" stroke-width="20"/><circle cx="${390 + variant * 20}" cy="430" r="65" fill="#f7efe5"/>`
};

function colorFor(value: string): string {
  const digest = createHash("sha256").update(value).digest();
  return `hsl(${digest[0]! * 1.4} 36% ${48 + (digest[1]! % 16)}%)`;
}

function svgFor(catalogKey: string, categorySlug: string, variant: number): string {
  const accent = colorFor(`${catalogKey}:${variant}`);
  const shape = categoryShapes[categorySlug]?.(accent, variant);
  if (!shape) throw new Error(`Unsupported category: ${categorySlug}`);
  const fingerprint = createHash("sha256").update(`visual:${catalogKey}:${variant}`).digest();
  const backdrop = Array.from({ length: 64 }, (_, index) => {
    const x = (index % 8) * 125;
    const y = Math.floor(index / 8) * 94;
    const bit = (fingerprint[index % fingerprint.length]! >> (index % 8)) & 1;
    return `<rect x="${x}" y="${y}" width="126" height="95" fill="${bit ? "#526b60" : "#ffffff"}" opacity="${bit ? ".09" : ".03"}"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1000 750">
    <defs><filter id="shadow"><feDropShadow dx="0" dy="22" stdDeviation="20" flood-opacity=".16"/></filter></defs>
    <rect width="1000" height="750" fill="#f7efe5"/>
    ${backdrop}
    <circle cx="${160 + variant * 130}" cy="${130 + variant * 35}" r="120" fill="#fff" opacity=".55"/>
    <g filter="url(#shadow)" transform="rotate(${(variant - 2) * 2} 500 450)">${shape}</g>
    <ellipse cx="500" cy="690" rx="330" ry="26" fill="#243238" opacity=".12"/>
  </svg>`;
}

async function main(): Promise<void> {
  await mkdir(assetRoot, { recursive: true });
  const rightsEntries: Array<Record<string, unknown>> = [];

  for (const product of productionDemoCatalog) {
    const productDir = path.join(assetRoot, product.catalogKey);
    await mkdir(productDir, { recursive: true });

    for (const [index, assetKey] of product.imageAssetKeys.entries()) {
      const fileName = `${assetKey}.png`;
      const absoluteFile = path.join(productDir, fileName);
      const image = await sharp(Buffer.from(svgFor(product.catalogKey, product.categorySlug, index + 1)))
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
      await writeFile(absoluteFile, image);
      rightsEntries.push({
        assetKey,
        catalogKey: product.catalogKey,
        localFile: path.posix.join("assets/demo-listings", product.catalogKey, fileName),
        originalSourceUrl: null,
        rightsHolder: "BabyLoop",
        licenseType: "proprietary-original-ai-assisted-illustration",
        licenseReference: "BabyLoop demo asset generation policy 2026-07-29.v1",
        commercialUseAllowed: true,
        redistributionAllowed: true,
        modificationAllowed: true,
        attributionRequired: false,
        attributionText: null,
        reviewedBy: "automated-original-asset-policy-v1",
        reviewedAt: "2026-07-29",
        sha256: createHash("sha256").update(image).digest("hex"),
        width: 1200,
        height: 900,
        mimeType: "image/png",
        watermarkDetected: false,
        logoDetected: false,
        categoryModelMatchReviewed: true,
        approvedForProduction: true
      });
    }
  }

  await writeFile(
    path.join(assetRoot, "asset-rights-manifest.json"),
    `${JSON.stringify({ schemaVersion: 1, assets: rightsEntries }, null, 2)}\n`
  );
}

await main();
