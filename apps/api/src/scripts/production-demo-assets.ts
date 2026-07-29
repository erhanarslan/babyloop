import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { productionDemoCatalog } from "@babyloop/database/production-demo-product-sources";

const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");
const manifestPath = path.join(workspaceRoot, "assets/demo-listings/asset-rights-manifest.json");
const denylistedHosts = [
  "sahibinden.com", "letgo.com", "ebebek.com", "trendyol.com", "hepsiburada.com",
  "n11.com", "instagram.com", "facebook.com", "amazon."
];

type AssetEntry = {
  assetKey: string;
  catalogKey: string;
  localFile: string;
  originalSourceUrl: string | null;
  rightsHolder: string;
  licenseType: string;
  licenseReference: string;
  commercialUseAllowed: boolean;
  redistributionAllowed: boolean;
  modificationAllowed: boolean;
  attributionRequired: boolean;
  attributionText: string | null;
  reviewedBy: string;
  reviewedAt: string;
  sha256: string;
  width: number;
  height: number;
  mimeType: string;
  watermarkDetected: boolean;
  logoDetected: boolean;
  categoryModelMatchReviewed: boolean;
  approvedForProduction: boolean;
};

export type AssetAuditResult = {
  ok: boolean;
  catalogCount: number;
  assetCount: number;
  errors: string[];
  manifestSha256: string;
};

async function loadManifest(): Promise<{ assets: AssetEntry[]; raw: Buffer }> {
  const raw = await readFile(manifestPath);
  const parsed = JSON.parse(raw.toString("utf8")) as { schemaVersion?: unknown; assets?: unknown };
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.assets)) {
    throw new Error("Asset rights manifest schemaVersion=1 and assets[] are required.");
  }
  return { assets: parsed.assets as AssetEntry[], raw };
}

export async function auditProductionDemoAssets(): Promise<AssetAuditResult> {
  const { assets, raw } = await loadManifest();
  const errors: string[] = [];
  const catalogByKey = new Map(productionDemoCatalog.map((product) => [product.catalogKey, product]));
  const assetsByKey = new Map<string, AssetEntry>();
  const exactHashes = new Map<string, string>();
  const perceptualHashes = new Map<string, string>();

  for (const asset of assets) {
    if (!asset.assetKey || assetsByKey.has(asset.assetKey)) errors.push(`duplicate assetKey: ${asset.assetKey}`);
    assetsByKey.set(asset.assetKey, asset);
    const product = catalogByKey.get(asset.catalogKey);
    if (!product) errors.push(`${asset.assetKey}: unknown catalogKey`);
    if (product && !product.imageAssetKeys.includes(asset.assetKey)) errors.push(`${asset.assetKey}: catalog ownership mismatch`);
    if (!asset.commercialUseAllowed || !asset.redistributionAllowed || !asset.approvedForProduction) {
      errors.push(`${asset.assetKey}: production rights approval is incomplete`);
    }
    if (asset.watermarkDetected || asset.logoDetected || !asset.categoryModelMatchReviewed) {
      errors.push(`${asset.assetKey}: watermark/logo/category-model visual review failed`);
    }
    if (!asset.rightsHolder || !asset.licenseType || !asset.licenseReference || !asset.reviewedBy || !asset.reviewedAt) {
      errors.push(`${asset.assetKey}: rights provenance is incomplete`);
    }
    if (asset.attributionRequired && !asset.attributionText) errors.push(`${asset.assetKey}: attribution text missing`);
    if (asset.originalSourceUrl) {
      const host = new URL(asset.originalSourceUrl).hostname.toLowerCase();
      if (denylistedHosts.some((denied) => denied.endsWith(".") ? host.startsWith(denied) : host === denied || host.endsWith(`.${denied}`))) {
        errors.push(`${asset.assetKey}: denylisted source domain ${host}`);
      }
    }
    if (!/^assets\/demo-listings\/[a-z0-9-]+\/[a-z0-9-]+\.png$/.test(asset.localFile)) {
      errors.push(`${asset.assetKey}: unsafe or hotlinked localFile`);
      continue;
    }

    const absoluteFile = path.resolve(workspaceRoot, asset.localFile);
    if (!absoluteFile.startsWith(path.join(workspaceRoot, "assets/demo-listings") + path.sep)) {
      errors.push(`${asset.assetKey}: file escapes asset root`);
      continue;
    }

    try {
      const bytes = await readFile(absoluteFile);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (!/^[a-f0-9]{64}$/.test(asset.sha256) || asset.sha256 !== sha256) errors.push(`${asset.assetKey}: sha256 mismatch`);
      if (asset.mimeType !== "image/png" || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") errors.push(`${asset.assetKey}: MIME/signature mismatch`);
      const metadata = await sharp(bytes).metadata();
      if (metadata.width !== asset.width || metadata.height !== asset.height) errors.push(`${asset.assetKey}: dimensions mismatch`);
      if ((metadata.width ?? 0) < 800 || (metadata.height ?? 0) < 600) errors.push(`${asset.assetKey}: resolution below 800x600`);
      const exactOwner = exactHashes.get(sha256);
      if (exactOwner) errors.push(`${asset.assetKey}: exact duplicate of ${exactOwner}`);
      exactHashes.set(sha256, asset.assetKey);

      const pixels = await sharp(bytes).resize(9, 8, { fit: "fill" }).greyscale().raw().toBuffer();
      let dHash = "";
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) dHash += pixels[y * 9 + x]! > pixels[y * 9 + x + 1]! ? "1" : "0";
      }
      for (const [otherHash, otherKey] of perceptualHashes) {
        const distance = [...dHash].reduce((sum, bit, index) => sum + (bit === otherHash[index] ? 0 : 1), 0);
        if (distance <= 2) errors.push(`${asset.assetKey}: perceptual duplicate of ${otherKey} (distance ${distance})`);
      }
      perceptualHashes.set(dHash, asset.assetKey);
    } catch (error) {
      errors.push(`${asset.assetKey}: unreadable image (${error instanceof Error ? error.message : "unknown"})`);
    }
  }

  for (const product of productionDemoCatalog) {
    if (product.imageAssetKeys.length < 3 || product.imageAssetKeys.length > 5) errors.push(`${product.catalogKey}: requires 3-5 assets`);
    for (const assetKey of product.imageAssetKeys) if (!assetsByKey.has(assetKey)) errors.push(`${product.catalogKey}: missing ${assetKey}`);
  }

  if (productionDemoCatalog.length !== 60) errors.push(`catalog must contain exactly 60 products`);
  if (assets.length !== 180) errors.push(`asset manifest must contain exactly 180 assets`);
  return {
    ok: errors.length === 0,
    catalogCount: productionDemoCatalog.length,
    assetCount: assets.length,
    errors,
    manifestSha256: createHash("sha256").update(raw).digest("hex")
  };
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: workspaceRoot, encoding: "utf8" }).trim();
}

function requireUploadGuards(): { bucket: string; cdnBaseUrl: string; gitSha: string } {
  const required: Record<string, string> = {
    DEPLOY_ENVIRONMENT: "production",
    DEPLOY_TOPOLOGY: "single_environment",
    DEMO_ASSET_UPLOAD_CONFIRM: "UPLOAD_PRODUCTION_DEMO_ASSETS"
  };
  for (const [key, expected] of Object.entries(required)) if (process.env[key] !== expected) throw new Error(`${key} must equal ${expected}.`);
  if (git("branch", "--show-current") !== "master") throw new Error("Asset upload requires the master branch.");
  if (git("status", "--porcelain")) throw new Error("Asset upload requires a clean worktree.");
  const gitSha = git("rev-parse", "HEAD");
  if (!/^[a-f0-9]{40}$/.test(process.env.DEMO_ASSET_UPLOAD_GIT_SHA ?? "") || process.env.DEMO_ASSET_UPLOAD_GIT_SHA !== gitSha) {
    throw new Error("DEMO_ASSET_UPLOAD_GIT_SHA must be the exact full current Git SHA.");
  }
  const cdnBaseUrl = (process.env.DEMO_ASSET_BASE_URL ?? "").replace(/\/$/, "");
  if (cdnBaseUrl !== "https://cdn.babyloop.com.tr") throw new Error("DEMO_ASSET_BASE_URL must be the production CDN origin.");
  const bucket = process.env.R2_BUCKET_NAME ?? "";
  if (!bucket || bucket !== process.env.EXPECTED_R2_BUCKET_NAME) throw new Error("R2 bucket must exactly match EXPECTED_R2_BUCKET_NAME.");
  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error("R2 upload credentials are not configured.");
  return { bucket, cdnBaseUrl, gitSha };
}

async function uploadAssets(): Promise<void> {
  const guard = requireUploadGuards();
  const audit = await auditProductionDemoAssets();
  if (!audit.ok) throw new Error(`Asset audit failed: ${audit.errors.join("; ")}`);
  const { assets } = await loadManifest();
  const endpoint = process.env.R2_ENDPOINT!;
  const client = new S3Client({
    endpoint,
    region: "auto",
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! }
  });
  let uploaded = 0;
  let unchanged = 0;
  for (const asset of assets) {
    const key = `demo/listings/${asset.catalogKey}/${path.basename(asset.localFile)}`;
    let exists = false;
    let existingSha: string | undefined;
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: guard.bucket, Key: key }));
      exists = true;
      existingSha = head.Metadata?.sha256;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status !== 404) throw error;
    }
    if (exists) {
      if (existingSha !== asset.sha256) throw new Error(`${key}: existing object differs; overwrite is disabled.`);
      unchanged += 1;
    } else {
      await client.send(new PutObjectCommand({
        Bucket: guard.bucket,
        Key: key,
        Body: await readFile(path.resolve(workspaceRoot, asset.localFile)),
        ContentType: asset.mimeType,
        Metadata: { sha256: asset.sha256, catalogkey: asset.catalogKey }
      }));
      uploaded += 1;
    }
    const publicUrl = `${guard.cdnBaseUrl}/${key}`;
    const response = await fetch(publicUrl, { method: "HEAD", redirect: "error" });
    if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "image/png") throw new Error(`${publicUrl}: external HEAD/content-type verification failed.`);
  }
  const receiptDir = path.join(workspaceRoot, ".release/demo-seed/production");
  await mkdir(receiptDir, { recursive: true });
  await writeFile(path.join(receiptDir, "asset-upload-receipt.json"), `${JSON.stringify({
    schemaVersion: 1, kind: "production-demo-asset-upload", status: "complete", environment: "production",
    topology: "single_environment", gitSha: guard.gitSha, manifestSha256: audit.manifestSha256,
    assetCount: audit.assetCount, uploaded, unchanged, overwriteEnabled: false, completedAt: new Date().toISOString()
  }, null, 2)}\n`);
}

const mode = process.argv[2] ?? "audit";
if (mode === "upload") {
  await uploadAssets();
} else {
  const result = await auditProductionDemoAssets();
  const output = mode === "plan" ? { ...result, mutationPlanned: false, uploadCount: result.assetCount, productionPrefix: "demo/listings/" } : result;
  console.log(JSON.stringify(output, null, 2));
  if (!result.ok) process.exitCode = 1;
}
