#!/usr/bin/env node

import { createRequire } from "node:module";
import { mkdir, stat } from "node:fs/promises";
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
  border: "#f0d5c7",
  cream: "#ffe5d6",
  primary: "#d75f3f",
  primaryDark: "#a9432c",
  surface: "#ffffff",
  text: "#2f2521",
  muted: "#74645d"
};

export const SLIDES = [
  {
    id: "01-cover",
    title: "BabyLoop Mobil",
    description: "Yapay zekâ destekli ebeveyn marketplace’i",
    coverSources: ["02-discover", "03-listing-detail", "06-parent-assistant-rag"]
  },
  {
    id: "02-discover",
    title: "İhtiyaca Uygun Ürünleri Keşfet",
    description: "Kategori, yaş aralığı ve kişiselleştirilmiş öneriler"
  },
  {
    id: "03-listing-detail",
    title: "Güvenli ve Detaylı İlanlar",
    description: "Ürün bilgileri, yaş uygunluğu ve satıcı iletişimi"
  },
  {
    id: "04-ai-link-import",
    title: "Fotoğrafla İlan Oluşturmaya Başla",
    description: "Ürün görsellerini ve temel bilgileri tek akışta hazırla"
  },
  {
    id: "05-ai-listing-assistant",
    title: "Yapay Zekâ Destekli İlan",
    description: "Fotoğraflardan başlık, açıklama, kategori ve fiyat önerileri"
  },
  {
    id: "06-parent-assistant-rag",
    title: "Güvenli Ebeveyn Asistanı",
    description: "RAG altyapısıyla kaynak yeterliliğini kontrol eden yanıtlar"
  },
  {
    id: "08-account-security",
    title: "Hesap ve Güvenlik",
    description: "MFA, oturum yönetimi ve doğrulama akışları"
  }
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function backgroundSvg(title, description, cover = false) {
  const titleSize = cover ? 62 : 48;
  const titleY = cover ? 168 : 126;
  const descriptionY = cover ? 224 : 190;

  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${palette.background}"/>
          <stop offset="1" stop-color="#fff0e7"/>
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
      <circle cx="965" cy="120" r="180" fill="${palette.cream}" opacity="0.72"/>
      <circle cx="70" cy="1210" r="220" fill="#f7c8b5" opacity="0.38"/>
      <rect x="70" y="54" width="164" height="42" rx="21" fill="${palette.primary}"/>
      <text x="152" y="82" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="20" font-weight="800" fill="#ffffff" letter-spacing="1.4">BABYLOOP</text>
      <text x="70" y="${titleY}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${titleSize}" font-weight="800" fill="${palette.text}">${escapeXml(title)}</text>
      <text x="70" y="${descriptionY}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="25" font-weight="500" fill="${palette.muted}">${escapeXml(description)}</text>
    </svg>
  `);
}

async function screenshotBuffer(sourcePath, screenWidth, screenHeight) {
  const metadata = await sharp(sourcePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`PNG boyutu okunamadı: ${sourcePath}`);
  }

  const topCrop = Math.min(Math.round(metadata.height * 0.037), metadata.height - 2);
  const bottomCrop = Math.min(Math.round(metadata.height * 0.012), metadata.height - topCrop - 1);
  const croppedHeight = metadata.height - topCrop - bottomCrop;

  return sharp(sourcePath)
    .extract({ left: 0, top: topCrop, width: metadata.width, height: croppedHeight })
    .resize({
      width: screenWidth,
      height: screenHeight,
      fit: "contain",
      background: palette.background
    })
    .composite([
      {
        input: Buffer.from(`<svg width="${screenWidth}" height="${screenHeight}"><rect width="${screenWidth}" height="${screenHeight}" rx="34" fill="#fff"/></svg>`),
        blend: "dest-in"
      }
    ])
    .png()
    .toBuffer();
}

async function phoneBuffer(sourcePath, phoneWidth, phoneHeight) {
  const inset = Math.max(11, Math.round(phoneWidth * 0.027));
  const screen = await screenshotBuffer(sourcePath, phoneWidth - inset * 2, phoneHeight - inset * 2);
  const frame = Buffer.from(`
    <svg width="${phoneWidth}" height="${phoneHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${phoneWidth - 2}" height="${phoneHeight - 2}" rx="${Math.round(phoneWidth * 0.105)}" fill="#211b18" stroke="#4b3d37" stroke-width="2"/>
      <rect x="${Math.round(phoneWidth * 0.38)}" y="${Math.round(phoneWidth * 0.035)}" width="${Math.round(phoneWidth * 0.24)}" height="${Math.round(phoneWidth * 0.025)}" rx="8" fill="#0e0c0b"/>
    </svg>
  `);

  return sharp({
    create: {
      width: phoneWidth,
      height: phoneHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: frame, left: 0, top: 0 },
      { input: screen, left: inset, top: inset }
    ])
    .png()
    .toBuffer();
}

async function composeStandardSlide(slide, rawDir, outputPath) {
  const phone = await phoneBuffer(path.join(rawDir, `${slide.id}.png`), 500, 1030);
  const shadow = Buffer.from(`
    <svg width="560" height="1090" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="s"><feGaussianBlur stdDeviation="22"/></filter></defs>
      <rect x="30" y="30" width="500" height="1030" rx="54" fill="#7a3e2d" opacity="0.22" filter="url(#s)"/>
    </svg>
  `);

  await sharp(backgroundSvg(slide.title, slide.description))
    .composite([
      { input: shadow, left: 260, top: 242 },
      { input: phone, left: 290, top: 260 }
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function composeCoverSlide(slide, rawDir, outputPath) {
  const rotations = [-7, 0, 7];
  const positions = [
    { left: 42, top: 405 },
    { left: 360, top: 315 },
    { left: 680, top: 410 }
  ];
  const phones = await Promise.all(slide.coverSources.map(async (sourceId, index) => {
    const phone = await phoneBuffer(path.join(rawDir, `${sourceId}.png`), 330, 720);
    return sharp(phone)
      .rotate(rotations[index], { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }));

  await sharp(backgroundSvg(slide.title, slide.description, true))
    .composite(phones.map((input, index) => ({ input, ...positions[index] })))
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

export async function composeCarousel({ rawDir, outputDir, logger = console.log }) {
  await mkdir(outputDir, { recursive: true });
  const outputs = [];

  for (const slide of SLIDES) {
    const rawPath = path.join(rawDir, `${slide.id}.png`);
    const rawStats = await stat(rawPath);

    if (rawStats.size === 0) {
      throw new Error(`Ham ekran görüntüsü boş: ${rawPath}`);
    }

    const outputPath = path.join(outputDir, `${slide.id}.png`);

    if (slide.coverSources) {
      await composeCoverSlide(slide, rawDir, outputPath);
    } else {
      await composeStandardSlide(slide, rawDir, outputPath);
    }

    const metadata = await sharp(outputPath).metadata();
    if (metadata.width !== WIDTH || metadata.height !== HEIGHT) {
      throw new Error(`Carousel boyutu hatalı: ${outputPath}`);
    }

    outputs.push(outputPath);
    logger(`Oluşturuldu: ${outputPath}`);
  }

  return outputs;
}

function parseArguments(argv) {
  const options = {
    rawDir: path.join(repositoryRoot, "artifacts/linkedin/mobile/raw"),
    outputDir: path.join(repositoryRoot, "artifacts/linkedin/mobile/carousel")
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--raw" && argv[index + 1]) {
      options.rawDir = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--output" && argv[index + 1]) {
      options.outputDir = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  composeCarousel(parseArguments(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.message : "Carousel üretilemedi.");
    process.exitCode = 1;
  });
}
