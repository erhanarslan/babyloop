import { describe, expect, it } from "vitest";

import { applyOpenApiRouteContract } from "../src/openapi/openapi-contracts.js";

type SchemaRecord = Record<string, unknown>;

function contract(method: string, url: string): SchemaRecord {
  return applyOpenApiRouteContract({
    method,
    schema: {},
    url
  });
}

function record(value: unknown): SchemaRecord {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);

  return value as SchemaRecord;
}

function propertiesOf(schema: SchemaRecord): SchemaRecord {
  return record(schema.properties);
}

describe("OpenAPI runtime contract alignment", () => {
  it("matches listing create and update Zod inputs", () => {
    const createBody = record(contract("POST", "/api/v1/listings").body);
    const createProperties = propertiesOf(createBody);

    expect(createBody.required).toEqual([
      "categoryId",
      "title",
      "listingType",
      "condition"
    ]);
    expect(createProperties).not.toHaveProperty("city");
    expect(createProperties).toHaveProperty("priceAmount");
    expect(record(createProperties.currency).pattern).toBe("^[A-Za-z]{3}$");

    const updateBody = record(
      contract("PATCH", "/api/v1/listings/:id").body
    );
    const updateProperties = propertiesOf(updateBody);

    expect(updateProperties).not.toHaveProperty("city");
    expect(updateProperties).toHaveProperty("currency");
    expect(updateBody.required).toBeUndefined();
  });

  it("matches listing query aliases and limits", () => {
    const query = record(contract("GET", "/api/v1/listings").querystring);
    const properties = propertiesOf(query);

    expect(record(properties.q).maxLength).toBe(120);
    expect(record(properties.search).maxLength).toBe(120);
    expect(record(properties.limit).maximum).toBe(50);
  });

  it("matches mock checkout and AI price request bodies", () => {
    const checkoutBody = record(
      contract("POST", "/api/v1/checkout/mock-iyzico").body
    );
    const checkoutProperties = propertiesOf(checkoutBody);

    expect(Object.keys(checkoutProperties)).toEqual(["scenario"]);
    expect(record(checkoutProperties.scenario).enum).toEqual([
      "success",
      "failure"
    ]);

    const priceBody = record(
      contract("POST", "/api/v1/ai/price-suggestions").body
    );
    const priceProperties = propertiesOf(priceBody);

    expect(Object.keys(priceProperties).sort()).toEqual(
      [
        "title",
        "categoryName",
        "condition",
        "listingType",
        "currentPriceAmount",
        "currency"
      ].sort()
    );
    expect(priceProperties).not.toHaveProperty("categoryId");
    expect(priceProperties).not.toHaveProperty("city");
  });

  it("matches message and report validation constraints", () => {
    const messageBody = record(
      contract(
        "POST",
        "/api/v1/conversations/:id/messages"
      ).body
    );
    const messageProperties = propertiesOf(messageBody);

    expect(record(messageProperties.body).maxLength).toBe(500);

    const reportBody = record(
      contract(
        "POST",
        "/api/v1/reports/listings/:listingId"
      ).body
    );
    const reportProperties = propertiesOf(reportBody);

    expect(record(reportProperties.reason).enum).toEqual([
      "safety",
      "scam",
      "inappropriate",
      "prohibited_item",
      "harassment",
      "other"
    ]);
  });

  it("matches notification preference and push token inputs", () => {
    const preferenceBody = record(
      contract("PATCH", "/api/v1/notification-preferences").body
    );
    const preferenceProperties = propertiesOf(preferenceBody);

    expect(record(preferenceProperties.reason).maxLength).toBe(240);

    const registerBody = record(
      contract("POST", "/api/v1/notifications/push-tokens").body
    );
    const registerProperties = propertiesOf(registerBody);

    expect(record(registerProperties.token).minLength).toBe(20);
    expect(record(registerProperties.token).maxLength).toBe(2048);
    expect(record(registerProperties.platform).enum).toEqual([
      "ios",
      "android",
      "expo"
    ]);

    const revokeBody = record(
      contract("DELETE", "/api/v1/notifications/push-tokens").body
    );
    const revokeProperties = propertiesOf(revokeBody);

    expect(Object.keys(revokeProperties)).toEqual(["token"]);
    expect(revokeBody.required).toEqual(["token"]);
  });

  it("matches saved search query text length", () => {
    const body = record(
      contract("POST", "/api/v1/saved-searches").body
    );
    const properties = propertiesOf(body);

    expect(record(properties.q).maxLength).toBe(120);
  });
});
