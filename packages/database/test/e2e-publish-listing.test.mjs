import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import pg from "pg";
import {
  publishE2EListing,
  validateE2EDatabaseUrl
} from "../dist/e2e-publish-listing.js";

const { Client } = pg;
const databaseUrl = process.env.TEST_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test";
const cleanup = [];
let client;

test("remote and non-test database URLs are rejected before connecting", () => {
  assert.throws(
    () => validateE2EDatabaseUrl("postgresql://user:pass@db.example.com:5432/babyloop_test"),
    /localhost or a loopback address/
  );
  assert.throws(
    () => validateE2EDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:5432/babyloop_dev"),
    /exactly babyloop_test/
  );
  assert.throws(
    () => validateE2EDatabaseUrl("mysql://root@127.0.0.1:3306/babyloop_test"),
    /postgres or postgresql/
  );
});

before(async () => {
  validateE2EDatabaseUrl(databaseUrl, "TEST_DATABASE_URL");
  client = new Client({ connectionString: databaseUrl });
  await client.connect();
});

after(async () => {
  for (const fixture of cleanup.reverse()) {
    await client.query("delete from listings where id = $1", [fixture.listingId]);
    await client.query("delete from profiles where id = $1", [fixture.profileId]);
    await client.query("delete from users where id = $1", [fixture.userId]);
    await client.query("delete from product_categories where id = $1", [fixture.categoryId]);
  }
  await client.end();
});

test("a non-E2E listing is rejected without lifecycle or image mutation", async () => {
  const fixture = await createFixture({ title: "Ordinary listing" });

  await assert.rejects(() => publishE2EListing(fixture.listingId, databaseUrl), /title must start/);

  const state = await readState(fixture.listingId);
  assert.equal(state.listing.status, "draft");
  assert.equal(state.listing.publication_state, "awaiting_images");
  assert.equal(state.imageCount, 0);
});

test("a Web E2E listing becomes active and published with one approved image idempotently", async () => {
  const fixture = await createFixture({ title: `Web E2E fixture ${randomUUID()}` });

  const first = await publishE2EListing(fixture.listingId, databaseUrl);
  const second = await publishE2EListing(fixture.listingId, databaseUrl);
  const state = await readState(fixture.listingId);

  assert.deepEqual(second, first);
  assert.equal(first.status, "active");
  assert.equal(first.publicationState, "published");
  assert.equal(state.listing.status, "active");
  assert.equal(state.listing.publication_state, "published");
  assert.ok(state.listing.published_at instanceof Date);
  assert.equal(state.listing.publish_after, null);
  assert.equal(state.imageCount, 1);
  assert.equal(state.image.review_status, "approved");
  assert.equal(state.image.authenticity_provider, "e2e_fixture");
  assert.equal(state.image.authenticity_flags.source, "e2e_fixture");
});

test("the is_demo guard prevents fixture publication", async () => {
  const fixture = await createFixture({
    isDemo: true,
    title: `Web E2E demo guard ${randomUUID()}`
  });

  await assert.rejects(() => publishE2EListing(fixture.listingId, databaseUrl), /Demo listings cannot be changed/);

  const state = await readState(fixture.listingId);
  assert.equal(state.listing.status, "draft");
  assert.equal(state.listing.publication_state, "awaiting_images");
  assert.equal(state.imageCount, 0);
});

async function createFixture({ title, isDemo = false }) {
  const fixture = {
    categoryId: randomUUID(),
    listingId: randomUUID(),
    profileId: randomUUID(),
    userId: randomUUID()
  };
  cleanup.push(fixture);
  const marker = randomUUID();

  await client.query(
    "insert into users (id, email, password_hash) values ($1, $2, $3)",
    [fixture.userId, `web-e2e-${marker}@babyloop.test`, "!e2e-login-disabled"]
  );
  await client.query(
    "insert into profiles (id, user_id, display_name) values ($1, $2, $3)",
    [fixture.profileId, fixture.userId, "Web E2E Fixture Owner"]
  );
  await client.query(
    "insert into product_categories (id, name, slug) values ($1, $2, $3)",
    [fixture.categoryId, "Web E2E Fixture Category", `web-e2e-${marker}`]
  );
  await client.query(`
    insert into listings (
      id, seller_profile_id, category_id, title, condition, status,
      publication_state, is_demo, demo_seed_key, demo_seed_version
    ) values ($1, $2, $3, $4, 'good', 'draft', 'awaiting_images', $5, $6, $7)
  `, [
    fixture.listingId,
    fixture.profileId,
    fixture.categoryId,
    title,
    isDemo,
    isDemo ? `test:${marker}` : null,
    isDemo ? "test-v1" : null
  ]);

  return fixture;
}

async function readState(listingId) {
  const listing = await client.query(
    "select status, publication_state, published_at, publish_after from listings where id = $1",
    [listingId]
  );
  const images = await client.query(`
    select review_status, authenticity_provider, authenticity_flags
    from listing_images where listing_id = $1
  `, [listingId]);

  return {
    image: images.rows[0],
    imageCount: images.rowCount,
    listing: listing.rows[0]
  };
}
