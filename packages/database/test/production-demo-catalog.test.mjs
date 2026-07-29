import assert from "node:assert/strict";
import test from "node:test";
import {
  AFFILIATION_DISCLAIMER,
  DEMO_DISCLAIMER,
  PRODUCTION_DEMO_CATEGORY_COUNTS,
  productionDemoCatalog,
  productionDemoProductSources
} from "../dist/production-demo-product-sources.js";

test("production demo catalog has exactly 60 unique sourced products", () => {
  assert.equal(productionDemoCatalog.length, 60);
  assert.equal(new Set(productionDemoCatalog.map((item) => item.catalogKey)).size, 60);
  assert.equal(new Set(productionDemoCatalog.map((item) => `${item.brand}:${item.model}`)).size, 60);
  assert.equal(productionDemoProductSources.length, 60);
  const sources = new Map(productionDemoProductSources.map((source) => [source.catalogKey, source]));
  for (const product of productionDemoCatalog) {
    assert.equal(product.isDemo, true);
    assert.match(product.officialProductUrl, /^https:\/\//);
    assert.equal(sources.get(product.catalogKey)?.officialProductUrl, product.officialProductUrl);
  }
});

test("production demo category counts are exact", () => {
  const actual = Object.fromEntries(Object.keys(PRODUCTION_DEMO_CATEGORY_COUNTS).map((slug) => [
    slug,
    productionDemoCatalog.filter((item) => item.categorySlug === slug).length
  ]));
  assert.deepEqual(actual, PRODUCTION_DEMO_CATEGORY_COUNTS);
});

test("descriptions and image ownership satisfy the demo contract", () => {
  assert.equal(new Set(productionDemoCatalog.map((item) => item.description)).size, 60);
  const allAssetKeys = new Set();
  for (const product of productionDemoCatalog) {
    assert.equal(product.description.split("\n")[0], DEMO_DISCLAIMER);
    assert.equal(product.description.endsWith(AFFILIATION_DISCLAIMER), true);
    assert.ok(product.imageAssetKeys.length >= 3 && product.imageAssetKeys.length <= 5);
    for (const assetKey of product.imageAssetKeys) {
      assert.equal(allAssetKeys.has(assetKey), false);
      allAssetKeys.add(assetKey);
    }
  }
  assert.equal(allAssetKeys.size, 180);
});
