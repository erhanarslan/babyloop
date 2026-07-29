import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  AFFILIATION_DISCLAIMER,
  DEMO_DISCLAIMER,
  PRODUCTION_DEMO_CATEGORY_COUNTS,
  PRODUCTION_DEMO_SEED_VERSION,
  productionDemoCatalog,
  productionDemoProductSources
} from "./production-demo-product-sources.js";

const { Client } = pg;
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const receiptRoot = path.join(workspaceRoot, ".release/demo-seed/production");
const assetManifestPath = path.join(workspaceRoot, "assets/demo-listings/asset-rights-manifest.json");

type SeedMode = "plan" | "apply";
type JsonRecord = Record<string, unknown>;

export function validateProductionDemoCatalog(): string[] {
  const errors: string[] = [];
  const catalogKeys = new Set<string>();
  const models = new Set<string>();
  const descriptions = new Set<string>();
  const counts: Record<string, number> = {};
  const sources = new Map(productionDemoProductSources.map((source) => [source.catalogKey, source]));
  if (productionDemoCatalog.length !== 60) errors.push("Catalog must contain exactly 60 listings.");
  for (const product of productionDemoCatalog) {
    if (catalogKeys.has(product.catalogKey)) errors.push(`${product.catalogKey}: duplicate catalogKey`);
    catalogKeys.add(product.catalogKey);
    const modelKey = `${product.brand}:${product.model}`.toLocaleLowerCase("tr-TR");
    if (models.has(modelKey)) errors.push(`${product.catalogKey}: duplicate brand/model`);
    models.add(modelKey);
    if (!product.description.startsWith(`${DEMO_DISCLAIMER}\n`)) errors.push(`${product.catalogKey}: exact first-line disclaimer missing`);
    if (!product.description.endsWith(AFFILIATION_DISCLAIMER)) errors.push(`${product.catalogKey}: affiliation disclaimer missing`);
    if (descriptions.has(product.description)) errors.push(`${product.catalogKey}: duplicate description`);
    descriptions.add(product.description);
    if (!product.isDemo || !product.demoSeedKey || !product.demoSeedVersion) errors.push(`${product.catalogKey}: explicit demo metadata missing`);
    if (product.imageAssetKeys.length < 3 || product.imageAssetKeys.length > 5) errors.push(`${product.catalogKey}: requires 3-5 assets`);
    if (!sources.get(product.catalogKey)?.officialProductUrl.startsWith("https://")) errors.push(`${product.catalogKey}: official source missing`);
    counts[product.categorySlug] = (counts[product.categorySlug] ?? 0) + 1;
  }
  for (const [slug, expected] of Object.entries(PRODUCTION_DEMO_CATEGORY_COUNTS)) {
    if (counts[slug] !== expected) errors.push(`${slug}: expected ${expected}, found ${counts[slug] ?? 0}`);
  }
  return errors;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(namespace: string): string {
  const hex = sha256(`babyloop-production-demo:${namespace}`).slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16]!, 16) % 4]!;
  const compact = hex.join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: workspaceRoot, encoding: "utf8" }).trim();
}

async function readJson(file: string): Promise<JsonRecord> {
  return JSON.parse(await readFile(file, "utf8")) as JsonRecord;
}

function requireString(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export async function validateSeedGuards(mode: SeedMode): Promise<{
  databaseUrl: string;
  gitSha: string;
  assetManifestSha256: string;
  assetUploadReceipt: JsonRecord;
  assetUploadReceiptSha256: string;
  backupReceipt: JsonRecord;
  backupReceiptSha256: string;
}> {
  if (process.env.DEPLOY_ENVIRONMENT !== "production") throw new Error("DEPLOY_ENVIRONMENT must equal production.");
  if (process.env.DEPLOY_TOPOLOGY !== "single_environment") throw new Error("DEPLOY_TOPOLOGY must equal single_environment.");
  if (mode === "apply" && process.env.DEMO_SEED_PRODUCTION_CONFIRM !== "SEED_PRODUCTION_DEMO_DATA") {
    throw new Error("DEMO_SEED_PRODUCTION_CONFIRM is invalid.");
  }
  if (git("branch", "--show-current") !== "master") throw new Error("Production demo seed requires master.");
  if (git("status", "--porcelain")) throw new Error("Production demo seed requires a clean worktree.");
  const gitSha = git("rev-parse", "HEAD");
  if (!/^[a-f0-9]{40}$/.test(process.env.DEMO_SEED_GIT_SHA ?? "") || process.env.DEMO_SEED_GIT_SHA !== gitSha) {
    throw new Error("DEMO_SEED_GIT_SHA must be the exact full current Git SHA.");
  }
  if (requireString("GCP_PROJECT_ID") !== requireString("EXPECTED_GCP_PROJECT_ID")) throw new Error("Production project mismatch.");
  if (requireString("DEMO_ASSET_BASE_URL").replace(/\/$/, "") !== "https://cdn.babyloop.com.tr") throw new Error("DEMO_ASSET_BASE_URL must be the production CDN origin.");

  const databaseUrl = requireString("DATABASE_URL");
  const parsedDatabaseUrl = new URL(databaseUrl);
  if (parsedDatabaseUrl.protocol !== "postgresql:" && parsedDatabaseUrl.protocol !== "postgres:") throw new Error("DATABASE_URL must use PostgreSQL.");
  const sslMode = parsedDatabaseUrl.searchParams.get("sslmode") ?? process.env.PGSSLMODE;
  if (sslMode !== "require" && sslMode !== "verify-full") throw new Error("Production database TLS is required.");
  if (decodeURIComponent(parsedDatabaseUrl.pathname.slice(1)) !== requireString("EXPECTED_DATABASE_NAME")) throw new Error("Production database name mismatch.");

  const catalogErrors = validateProductionDemoCatalog();
  if (catalogErrors.length) throw new Error(`Catalog validation failed: ${catalogErrors.join("; ")}`);
  const assetManifest = await readFile(assetManifestPath);
  const assetManifestJson = JSON.parse(assetManifest.toString("utf8")) as { assets?: unknown[] };
  if (assetManifestJson.assets?.length !== 180) throw new Error("Asset rights manifest must contain 180 assets.");
  const assetManifestSha256 = sha256(assetManifest);

  const assetUploadReceiptPath = requireString("DEMO_ASSET_UPLOAD_RECEIPT_PATH");
  const assetUploadReceiptBytes = await readFile(assetUploadReceiptPath);
  const assetUploadReceipt = JSON.parse(assetUploadReceiptBytes.toString("utf8")) as JsonRecord;
  if (assetUploadReceipt.status !== "complete" || assetUploadReceipt.environment !== "production" || assetUploadReceipt.topology !== "single_environment" || assetUploadReceipt.gitSha !== gitSha || assetUploadReceipt.manifestSha256 !== assetManifestSha256 || assetUploadReceipt.assetCount !== 180) {
    throw new Error("Asset upload receipt does not match the approved production manifest.");
  }

  const backupReceiptPath = requireString("BACKUP_RECEIPT_PATH");
  const backupReceiptBytes = await readFile(backupReceiptPath);
  const backupReceipt = JSON.parse(backupReceiptBytes.toString("utf8")) as JsonRecord;
  const completedAt = typeof backupReceipt.completedAt === "string" ? Date.parse(backupReceipt.completedAt) : Number.NaN;
  const maxBackupAgeMs = Number(process.env.DEMO_SEED_MAX_BACKUP_AGE_SECONDS ?? "86400") * 1000;
  if (backupReceipt.status !== "complete" || backupReceipt.environment !== "production" || !Number.isFinite(completedAt) || Date.now() - completedAt > maxBackupAgeMs) {
    throw new Error("A valid recent production backup receipt is required.");
  }

  return {
    databaseUrl,
    gitSha,
    assetManifestSha256,
    assetUploadReceipt,
    assetUploadReceiptSha256: sha256(assetUploadReceiptBytes),
    backupReceipt,
    backupReceiptSha256: sha256(backupReceiptBytes)
  };
}

async function inspectDatabase(client: pg.Client): Promise<{ conflicts: string[]; existingDemoCount: number }> {
  const migrationColumns = await client.query<{ column_name: string }>(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'listings'
      and column_name in ('is_demo', 'demo_seed_key', 'demo_seed_version')
  `);
  if (migrationColumns.rowCount !== 3) throw new Error("Production demo migration 0045 is not applied.");
  const latestMigrationSql = await readFile(path.join(workspaceRoot, "packages/database/drizzle/0045_production_demo_marketplace.sql"));
  const latestMigration = await client.query<{ hash: string }>(
    `select hash from drizzle.__drizzle_migrations order by created_at desc limit 1`
  );
  if (latestMigration.rows[0]?.hash !== sha256(latestMigrationSql)) {
    throw new Error("Database migration chain is not current through 0045_production_demo_marketplace.");
  }

  const keys = productionDemoCatalog.map((product) => product.demoSeedKey);
  const existing = await client.query<{ demo_seed_key: string; is_demo: boolean }>(
    `select demo_seed_key, is_demo from listings where demo_seed_key = any($1::text[])`, [keys]
  );
  const conflicts = existing.rows.filter((row) => !row.is_demo).map((row) => row.demo_seed_key);
  const sellers = Array.from({ length: 8 }, (_, index) => `demo-seller-${String(index + 1).padStart(2, "0")}@demo.babyloop.invalid`);
  const sellerConflicts = await client.query<{ email: string }>(
    `select email from users where email = any($1::text[]) and is_demo_system_account = false`, [sellers]
  );
  conflicts.push(...sellerConflicts.rows.map((row) => `user:${row.email}`));
  return { conflicts, existingDemoCount: existing.rows.filter((row) => row.is_demo).length };
}

function receiptBase(input: {
  kind: string;
  status: string;
  gitSha: string;
  assetManifestSha256: string;
  assetUploadReceiptSha256: string;
  backupReceiptSha256: string;
  startedAt: string;
}) {
  const counts = Object.fromEntries(Object.keys(PRODUCTION_DEMO_CATEGORY_COUNTS).map((slug) => [slug, productionDemoCatalog.filter((item) => item.categorySlug === slug).length]));
  return {
    schemaVersion: 1, kind: input.kind, status: input.status, environment: "production", topology: "single_environment",
    gitSha: input.gitSha, seedVersion: PRODUCTION_DEMO_SEED_VERSION,
    catalogSha256: sha256(JSON.stringify(productionDemoCatalog)),
    sourceManifestSha256: sha256(JSON.stringify(productionDemoProductSources)),
    assetRightsManifestSha256: input.assetManifestSha256,
    assetUploadReceiptSha256: input.assetUploadReceiptSha256,
    backupReceiptSha256: input.backupReceiptSha256,
    listingCount: 60, imageCount: 180, sellerCount: 8, categoryCounts: counts,
    conflicts: [] as string[], nonDemoRowsTouched: 0, externalProviderCallsExecuted: false,
    notificationsTriggered: false, startedAt: input.startedAt
  };
}

async function applySeed(client: pg.Client, cdnBaseUrl: string): Promise<{ inserted: number; updated: number; unchanged: number }> {
  await client.query("begin");
  try {
    await client.query("select pg_advisory_xact_lock(hashtext('babyloop:production-demo-seed:v1'))");
    const inspection = await inspectDatabase(client);
    if (inspection.conflicts.length) throw new Error(`Non-demo ownership conflicts: ${inspection.conflicts.join(", ")}`);

    const categoryRows = await client.query<{ id: string; slug: string }>(
      `select id, slug from product_categories where slug = any($1::text[])`, [Object.keys(PRODUCTION_DEMO_CATEGORY_COUNTS)]
    );
    const categoryIds = new Map(categoryRows.rows.map((row) => [row.slug, row.id]));
    if (categoryIds.size !== 10) throw new Error("All 10 production demo categories must already exist.");

    const sellerProfiles = new Map<string, string>();
    for (let index = 1; index <= 8; index += 1) {
      const number = String(index).padStart(2, "0");
      const sellerKey = `demo-seller-${number}`;
      const userId = deterministicUuid(`user:${sellerKey}`);
      const profileId = deterministicUuid(`profile:${sellerKey}`);
      const email = `${sellerKey}@demo.babyloop.invalid`;
      const passwordHash = `!login-disabled:${sha256(`${sellerKey}:${PRODUCTION_DEMO_SEED_VERSION}`)}`;
      await client.query(`
        insert into users (id, email, password_hash, role, is_demo_system_account, login_disabled, provider_delivery_disabled)
        values ($1, $2, $3, 'user', true, true, true)
        on conflict (email) do update set updated_at = now()
        where users.is_demo_system_account = true and users.login_disabled = true
      `, [userId, email, passwordHash]);
      await client.query(`
        insert into profiles (id, user_id, display_name, location_city, is_demo_system_profile)
        values ($1, $2, $3, $4, true)
        on conflict (user_id) do update set display_name = excluded.display_name, location_city = excluded.location_city, updated_at = now()
        where profiles.is_demo_system_profile = true
      `, [profileId, userId, `BabyLoop Demo Ailesi ${number}`, ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Eskişehir", "Kocaeli", "Muğla"][index - 1]]);
      sellerProfiles.set(sellerKey, profileId);
    }

    for (const product of productionDemoCatalog) {
      const listingId = deterministicUuid(`listing:${product.catalogKey}`);
      const result = await client.query(`
        insert into listings (
          id, seller_profile_id, category_id, title, description, price_amount, currency, status,
          publication_state, published_at, listing_type, condition, recommended_age_min_months,
          recommended_age_max_months, is_demo, demo_seed_key, demo_seed_version
        ) values ($1,$2,$3,$4,$5,$6,$7,'active','published',now(),$8,$9,$10,$11,true,$12,$13)
        on conflict (demo_seed_key) where demo_seed_key is not null do update set
          seller_profile_id=excluded.seller_profile_id, category_id=excluded.category_id, title=excluded.title,
          description=excluded.description, price_amount=excluded.price_amount, currency=excluded.currency,
          listing_type=excluded.listing_type, condition=excluded.condition,
          recommended_age_min_months=excluded.recommended_age_min_months,
          recommended_age_max_months=excluded.recommended_age_max_months, demo_seed_version=excluded.demo_seed_version,
          updated_at=now()
        where listings.is_demo = true
        returning id
      `, [listingId, sellerProfiles.get(product.sellerKey), categoryIds.get(product.categorySlug), product.title,
        product.description, product.priceAmount, product.currency, product.listingType, product.condition,
        product.recommendedAgeMinMonths, product.recommendedAgeMaxMonths, product.demoSeedKey, product.demoSeedVersion]);
      if (result.rowCount !== 1) throw new Error(`${product.catalogKey}: listing upsert was rejected fail-closed.`);
      for (const [sortOrder, assetKey] of product.imageAssetKeys.entries()) {
        const imageId = deterministicUuid(`image:${assetKey}`);
        const url = `${cdnBaseUrl}/demo/listings/${product.catalogKey}/${assetKey}.png`;
        await client.query(`
          insert into listing_images (id, listing_id, url, content_hash, sort_order, review_status, reviewed_at)
          values ($1,$2,$3,$4,$5,'approved',now())
          on conflict (id) do update set url=excluded.url, content_hash=excluded.content_hash,
            sort_order=excluded.sort_order, review_status='approved', reviewed_at=now()
          where listing_images.listing_id = excluded.listing_id
        `, [imageId, result.rows[0].id, url, sha256(assetKey), sortOrder]);
      }
    }
    await client.query("commit");
    return { inserted: 60 - inspection.existingDemoCount, updated: inspection.existingDemoCount, unchanged: 0 };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main(): Promise<void> {
  const mode: SeedMode = process.argv.includes("--apply") ? "apply" : "plan";
  const startedAt = new Date().toISOString();
  const guards = await validateSeedGuards(mode);
  const client = new Client({ connectionString: guards.databaseUrl, ssl: { rejectUnauthorized: true } });
  await client.connect();
  try {
    const inspection = await inspectDatabase(client);
    if (inspection.conflicts.length) throw new Error(`Conflicts: ${inspection.conflicts.join(", ")}`);
    const common = receiptBase({
      kind: mode === "apply" ? "production-demo-seed-apply" : "production-demo-seed-plan",
      status: mode === "apply" ? "complete" : "planned", gitSha: guards.gitSha,
      assetManifestSha256: guards.assetManifestSha256,
      assetUploadReceiptSha256: guards.assetUploadReceiptSha256,
      backupReceiptSha256: guards.backupReceiptSha256, startedAt
    });
    const counts = mode === "apply"
      ? await applySeed(client, requireString("DEMO_ASSET_BASE_URL").replace(/\/$/, ""))
      : { inserted: 60 - inspection.existingDemoCount, updated: inspection.existingDemoCount, unchanged: 0 };
    const receipt = { ...common, ...counts, transactionCommitted: mode === "apply", completedAt: new Date().toISOString() };
    await mkdir(receiptRoot, { recursive: true });
    await writeFile(path.join(receiptRoot, `${mode}-receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(JSON.stringify(receipt, null, 2));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
