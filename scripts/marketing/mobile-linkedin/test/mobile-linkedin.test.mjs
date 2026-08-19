import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { composeCarousel, SLIDES } from "../compose.mjs";
import { composeFinalCarousel, FINAL_FILES } from "../compose-final.mjs";
import { verifyLocalDatabaseUrl, verifyLocalHttpUrl } from "../preflight.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const requireFromApi = createRequire(path.join(repositoryRoot, "apps/api/package.json"));
const sharp = requireFromApi("sharp");

test("local target guard rejects remote API and database URLs", () => {
  assert.equal(verifyLocalDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"), true);
  assert.equal(verifyLocalHttpUrl("http://localhost:4000", "API"), true);
  assert.throws(
    () => verifyLocalDatabaseUrl("postgresql://user:pass@database.example.com:5432/babyloop"),
    /yalnız local\/test/iu
  );
  assert.throws(
    () => verifyLocalHttpUrl("https://api.babyloop.com.tr", "API"),
    /yalnız yerel/iu
  );
});

test("capture entrypoint keeps device and lossless adb screenshot guards", async () => {
  const source = await readFile(path.join(repositoryRoot, "scripts/marketing/mobile-linkedin/capture.sh"), "utf8");

  assert.match(source, /ANDROID_SERIAL/u);
  assert.match(source, /unauthorized/u);
  assert.match(source, /com\.babyloop\.mobile/u);
  assert.match(source, /exec-out screencap -p/u);
  assert.match(source, /MARKETING_API_URL/u);
  assert.match(source, /MARKETING_DEVICE_API_URL/u);
  assert.match(source, /BABYLOOP_MARKETING_DEMO_EMAIL/u);
  assert.match(source, /BABYLOOP_MARKETING_DEMO_PASSWORD/u);
  assert.match(source, /-name '\*\.png' -delete/u);
  assert.doesNotMatch(source, /EXPO_PUBLIC_API_BASE_URL="http:\/\/localhost:4000"/u);
  assert.doesNotMatch(source, /zeynep\.seed@example\.com|Test123456/u);
  assert.doesNotMatch(source, /07-messages/u);
});

test("composer produces seven non-empty 1080 by 1350 PNG files", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "babyloop-mobile-linkedin-"));
  const rawDir = path.join(workspace, "raw");
  const outputDir = path.join(workspace, "carousel");

  try {
    await mkdir(rawDir, { recursive: true });
    await Promise.all(SLIDES.map((slide, index) => sharp({
      create: {
        width: 360,
        height: 780,
        channels: 4,
        background: index % 2 === 0 ? "#fff7f2" : "#ffe5d6"
      }
    }).png().toFile(path.join(rawDir, `${slide.id}.png`))));

    const outputs = await composeCarousel({ rawDir, outputDir, logger: () => {} });
    assert.equal(outputs.length, 7);

    for (const output of outputs) {
      const metadata = await sharp(output).metadata();
      assert.equal(metadata.width, 1080);
      assert.equal(metadata.height, 1350);
      assert.equal(metadata.format, "png");
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("final composer preserves mobile slides and produces nine 1080 by 1350 PNG files", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "babyloop-final-linkedin-"));
  const mobileCarouselDir = path.join(workspace, "mobile");
  const backofficeRawDir = path.join(workspace, "backoffice");
  const outputDir = path.join(workspace, "final");

  try {
    await mkdir(mobileCarouselDir, { recursive: true });
    await mkdir(backofficeRawDir, { recursive: true });

    const mobileFiles = [
      "01-cover.png",
      "02-discover.png",
      "03-listing-detail.png",
      "04-ai-link-import.png",
      "05-ai-listing-assistant.png",
      "06-parent-assistant-rag.png",
      "08-account-security.png"
    ];

    await Promise.all(mobileFiles.map((fileName, index) => sharp({
      create: {
        width: 1080,
        height: 1350,
        channels: 4,
        background: index % 2 === 0 ? "#fff7f2" : "#ffe5d6"
      }
    }).png().toFile(path.join(mobileCarouselDir, fileName))));

    await Promise.all([
      "07-backoffice-dashboard.png",
      "08-backoffice-analytics.png"
    ].map((fileName) => sharp({
      create: {
        width: 1440,
        height: 1000,
        channels: 4,
        background: "#f7f7fb"
      }
    }).png().toFile(path.join(backofficeRawDir, fileName))));

    const outputs = await composeFinalCarousel({
      mobileCarouselDir,
      backofficeRawDir,
      outputDir,
      logger: () => {}
    });

    assert.deepEqual(outputs.map((output) => path.basename(output)), FINAL_FILES);

    for (const output of outputs) {
      const metadata = await sharp(output).metadata();
      assert.equal(metadata.width, 1080);
      assert.equal(metadata.height, 1350);
      assert.equal(metadata.format, "png");
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
