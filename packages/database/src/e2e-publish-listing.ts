import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Client } = pg;

const E2E_IMAGE_URL = "http://localhost:3000/brand/home/home-hero-travel.png";
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const LISTING_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type E2EPublishedListingSummary = {
  image: {
    contentHash: string;
    reviewStatus: "approved";
    url: string;
  };
  listingId: string;
  publicationState: "published";
  status: "active";
};

export function validateE2EDatabaseUrl(value: string, name = "DATABASE_URL"): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${name} must use postgres or postgresql.`);
  }

  if (!LOCAL_DATABASE_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`${name} must target localhost or a loopback address.`);
  }

  if (decodeURIComponent(parsed.pathname.slice(1)) !== "babyloop_test") {
    throw new Error(`${name} database name must be exactly babyloop_test.`);
  }

  return value;
}

export function resolveE2EDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL?.trim();
  const testDatabaseUrl = env.TEST_DATABASE_URL?.trim();

  if (databaseUrl && testDatabaseUrl && databaseUrl !== testDatabaseUrl) {
    throw new Error("DATABASE_URL and TEST_DATABASE_URL must be identical for E2E publication.");
  }

  const resolved = testDatabaseUrl || databaseUrl;
  if (!resolved) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL is required for E2E publication.");
  }

  return validateE2EDatabaseUrl(resolved, testDatabaseUrl ? "TEST_DATABASE_URL" : "DATABASE_URL");
}

export async function publishE2EListing(
  listingId: string,
  databaseUrl = resolveE2EDatabaseUrl()
): Promise<E2EPublishedListingSummary> {
  if (!LISTING_ID_PATTERN.test(listingId)) {
    throw new Error("listing ID must be a valid UUID.");
  }

  const guardedDatabaseUrl = validateE2EDatabaseUrl(databaseUrl);
  const client = new Client({ connectionString: guardedDatabaseUrl });
  const contentHash = createHash("sha256")
    .update(`babyloop:web-e2e:listing-image:${listingId}:v1`)
    .digest("hex");

  await client.connect();
  try {
    await client.query("begin");
    const target = await client.query<{
      email: string;
      is_demo: boolean;
      title: string;
    }>(`
      select l.title, l.is_demo, u.email
      from listings l
      join profiles p on p.id = l.seller_profile_id
      join users u on u.id = p.user_id
      where l.id = $1
      for update of l
    `, [listingId]);
    const listing = target.rows[0];

    if (!listing) {
      throw new Error("E2E listing publication target was not found.");
    }
    if (!listing.title.startsWith("Web E2E ")) {
      throw new Error("E2E listing title must start with 'Web E2E '.");
    }
    if (!listing.email.toLowerCase().endsWith("@babyloop.test")) {
      throw new Error("E2E listing owner email must end with @babyloop.test.");
    }
    if (listing.is_demo) {
      throw new Error("Demo listings cannot be changed by the E2E fixture publisher.");
    }

    await client.query(`
      insert into listing_images (
        listing_id, url, content_hash, sort_order, review_status, reviewed_at,
        authenticity_provider, authenticity_model, authenticity_prompt_version,
        authenticity_decision, authenticity_confidence, authenticity_reasons,
        authenticity_flags, authenticity_checked_at
      ) values (
        $1, $2, $3, 0, 'approved', now(),
        'e2e_fixture', 'local_seed_asset', 'e2e_fixture_v1',
        'approved', 1.0000, '["Local release E2E fixture image"]'::jsonb,
        '{"source":"e2e_fixture","sideEffects":"none"}'::jsonb, now()
      )
      on conflict (listing_id, content_hash) do update set
        url = excluded.url,
        sort_order = excluded.sort_order,
        review_status = excluded.review_status,
        reviewed_at = excluded.reviewed_at,
        authenticity_provider = excluded.authenticity_provider,
        authenticity_model = excluded.authenticity_model,
        authenticity_prompt_version = excluded.authenticity_prompt_version,
        authenticity_decision = excluded.authenticity_decision,
        authenticity_confidence = excluded.authenticity_confidence,
        authenticity_reasons = excluded.authenticity_reasons,
        authenticity_flags = excluded.authenticity_flags,
        authenticity_checked_at = excluded.authenticity_checked_at
    `, [listingId, E2E_IMAGE_URL, contentHash]);

    await client.query(`
      update listings
      set status = 'active',
          publication_state = 'published',
          published_at = coalesce(published_at, now()),
          publish_after = null,
          updated_at = now()
      where id = $1 and is_demo = false
    `, [listingId]);

    await client.query("commit");
    return {
      image: {
        contentHash,
        reviewStatus: "approved",
        url: E2E_IMAGE_URL
      },
      listingId,
      publicationState: "published",
      status: "active"
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

async function runCli(): Promise<void> {
  const listingId = process.argv[2];
  if (!listingId || process.argv.length !== 3) {
    throw new Error("Usage: e2e-publish-listing <listing-id>");
  }

  const summary = await publishE2EListing(listingId);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error: unknown) => {
    process.stderr.write(`E2E listing publication failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
