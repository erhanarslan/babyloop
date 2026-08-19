#!/usr/bin/env node

import { createRequire } from "node:module";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptPath);
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const requireFromApi = createRequire(path.join(repositoryRoot, "apps/api/package.json"));
const sharp = requireFromApi("sharp");

const WIDTH = 1080;
const HEIGHT = 1350;
const palette = {
  background: "#fff7f2",
  border: "#ead7cd",
  primary: "#d75f3f",
  purple: "#5b3fd2",
  surface: "#ffffff",
  text: "#2f2521",
  muted: "#74645d"
};

export const FINAL_FILES = [
  "01-cover.png",
  "02-discover.png",
  "03-listing-detail.png",
  "04-ai-link-import.png",
  "05-ai-listing-assistant.png",
  "06-parent-assistant-rag.png",
  "07-backoffice-dashboard.png",
  "08-backoffice-analytics.png",
  "09-account-security.png"
];

const BACKOFFICE_SLIDES = [
  {
    id: "07-backoffice-dashboard",
    title: "Operasyonları Tek Bakışta",
    description: "Yalnız admin rolüne açık güven ve emniyet görünümü",
    callouts: ["Toplu metrikler", "Admin erişimi", "Kişisel veri yok"]
  },
  {
    id: "08-backoffice-analytics",
    title: "RAG Operasyon Görünümü",
    description: "Admin erişimli bilgi tabanı, vektör dizini ve AI sağlığı",
    callouts: ["Bilgi tabanı", "Dizin sağlığı", "AI görünürlüğü"]
  }
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function backgroundSvg(slide) {
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${palette.background}"/>
          <stop offset="1" stop-color="#fff0e7"/>
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
      <circle cx="970" cy="95" r="175" fill="#eee9ff" opacity="0.9"/>
      <circle cx="65" cy="1255" r="220" fill="#f7c8b5" opacity="0.34"/>
      <rect x="70" y="54" width="164" height="42" rx="21" fill="${palette.purple}"/>
      <text x="152" y="82" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="20" font-weight="800" fill="#ffffff" letter-spacing="1.4">BABYLOOP</text>
      <text x="70" y="158" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="48" font-weight="800" fill="${palette.text}">${escapeXml(slide.title)}</text>
      <text x="70" y="214" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="25" font-weight="500" fill="${palette.muted}">${escapeXml(slide.description)}</text>
    </svg>
  `);
}

function browserFrameSvg() {
  return Buffer.from(`
    <svg width="970" height="690" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="shadow"><feGaussianBlur stdDeviation="18"/></filter></defs>
      <rect x="18" y="22" width="934" height="644" rx="28" fill="#6d4a3c" opacity="0.18" filter="url(#shadow)"/>
      <rect x="1" y="1" width="968" height="658" rx="24" fill="#ffffff" stroke="${palette.border}" stroke-width="2"/>
      <path d="M1 58H969" stroke="${palette.border}" stroke-width="2"/>
      <circle cx="28" cy="29" r="7" fill="#f47b64"/>
      <circle cx="50" cy="29" r="7" fill="#f5bd55"/>
      <circle cx="72" cy="29" r="7" fill="#66bf7a"/>
      <rect x="110" y="14" width="706" height="30" rx="15" fill="#f6f2f0"/>
      <text x="463" y="35" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="14" font-weight="700" fill="${palette.muted}">backoffice.babyloop.local · admin</text>
      <rect x="832" y="13" width="115" height="32" rx="16" fill="#edf8f0"/>
      <text x="889" y="34" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12" font-weight="800" fill="#257344">ADMIN ERİŞİMİ</text>
    </svg>
  `);
}

function calloutsSvg(callouts) {
  const cells = callouts.map((callout, index) => {
    const x = index * 300;
    return `
      <rect x="${x}" y="0" width="282" height="104" rx="24" fill="${palette.surface}" stroke="${palette.border}" stroke-width="2"/>
      <circle cx="${x + 35}" cy="35" r="12" fill="${palette.primary}"/>
      <path d="M${x + 29} ${35}l4 4 8-9" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="${x + 25}" y="79" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="20" font-weight="800" fill="${palette.text}">${escapeXml(callout)}</text>
    `;
  }).join("");

  return Buffer.from(`<svg width="882" height="104" xmlns="http://www.w3.org/2000/svg">${cells}</svg>`);
}

async function composeBackofficeSlide(slide, rawDir, outputPath) {
  const rawPath = path.join(rawDir, `${slide.id}.png`);
  const rawMetadata = await sharp(rawPath).metadata();

  if (!rawMetadata.width || !rawMetadata.height) {
    throw new Error(`Backoffice PNG boyutu okunamadı: ${rawPath}`);
  }

  const cropBottom = Math.min(80, rawMetadata.height - 1);
  const screenshot = await sharp(rawPath)
    .extract({
      left: 0,
      top: 0,
      width: rawMetadata.width,
      height: rawMetadata.height - cropBottom
    })
    .resize({ width: 930, height: 594, fit: "cover", position: "top" })
    .png()
    .toBuffer();

  await sharp(backgroundSvg(slide))
    .composite([
      { input: browserFrameSvg(), left: 55, top: 255 },
      { input: screenshot, left: 75, top: 314 },
      { input: calloutsSvg(slide.callouts), left: 99, top: 1010 }
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function assertPng(outputPath) {
  const outputStats = await stat(outputPath);
  const metadata = await sharp(outputPath).metadata();

  if (outputStats.size === 0 || metadata.width !== WIDTH || metadata.height !== HEIGHT || metadata.format !== "png") {
    throw new Error(`Nihai carousel PNG doğrulaması başarısız: ${outputPath}`);
  }
}

export async function composeFinalCarousel({ mobileCarouselDir, backofficeRawDir, outputDir, logger = console.log }) {
  await mkdir(outputDir, { recursive: true });

  const copies = [
    ["01-cover.png", "01-cover.png"],
    ["02-discover.png", "02-discover.png"],
    ["03-listing-detail.png", "03-listing-detail.png"],
    ["04-ai-link-import.png", "04-ai-link-import.png"],
    ["05-ai-listing-assistant.png", "05-ai-listing-assistant.png"],
    ["06-parent-assistant-rag.png", "06-parent-assistant-rag.png"],
    ["08-account-security.png", "09-account-security.png"]
  ];

  for (const [sourceName, outputName] of copies) {
    await copyFile(path.join(mobileCarouselDir, sourceName), path.join(outputDir, outputName));
  }

  for (const slide of BACKOFFICE_SLIDES) {
    await composeBackofficeSlide(slide, backofficeRawDir, path.join(outputDir, `${slide.id}.png`));
  }

  const outputs = FINAL_FILES.map((fileName) => path.join(outputDir, fileName));
  for (const output of outputs) {
    await assertPng(output);
    logger(`Doğrulandı: ${output}`);
  }

  return outputs;
}

function parseArguments(argv) {
  const options = {
    mobileCarouselDir: path.join(repositoryRoot, "artifacts/linkedin/mobile/carousel"),
    backofficeRawDir: path.join(repositoryRoot, "artifacts/linkedin/backoffice/raw"),
    outputDir: path.join(repositoryRoot, "artifacts/linkedin/final-carousel")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index + 1];
    if (argv[index] === "--mobile" && value) options.mobileCarouselDir = path.resolve(value);
    if (argv[index] === "--backoffice" && value) options.backofficeRawDir = path.resolve(value);
    if (argv[index] === "--output" && value) options.outputDir = path.resolve(value);
    if (["--mobile", "--backoffice", "--output"].includes(argv[index]) && value) index += 1;
  }

  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  composeFinalCarousel(parseArguments(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.message : "Nihai carousel üretilemedi.");
    process.exitCode = 1;
  });
}
