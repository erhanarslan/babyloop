import { describe, expect, it } from "vitest";

import { applyOpenApiRouteContract } from "../src/openapi/openapi-contracts.js";
import { adminAnalyticsQuerySchema } from "../src/schemas/admin-analytics.schemas.js";
import {
  createChildProfileReminderBodySchema,
  updateChildProfileReminderBodySchema
} from "../src/schemas/child-profile-notes-reminders.schemas.js";
import { productEventBodySchema } from "../src/schemas/product-events.schemas.js";

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
  it("documents the two-step account deletion contract", () => {
    const requestBody = record(
      contract(
        "POST",
        "/api/v1/auth/account-deletion/request"
      ).body
    );
    const requestProperties = propertiesOf(requestBody);

    expect(Object.keys(requestProperties)).toEqual([
      "currentPassword"
    ]);
    expect(requestBody.required).toBeUndefined();

    const confirmBody = record(
      contract(
        "POST",
        "/api/v1/auth/account-deletion/confirm"
      ).body
    );
    const confirmProperties = propertiesOf(confirmBody);

    expect(confirmBody.required).toEqual([
      "challengeId",
      "code",
      "confirmation"
    ]);
    expect(record(confirmProperties.code).pattern).toBe(
      "^\\d{6}$"
    );
    expect(record(confirmProperties.confirmation).enum).toEqual([
      "HESABIMI SİL"
    ]);

    const response = record(
      record(
        contract(
          "POST",
          "/api/v1/auth/account-deletion/confirm"
        ).response
      )["200"]
    );
    const responseProperties = propertiesOf(response);
    const data = record(responseProperties.data);
    const dataProperties = propertiesOf(data);

    expect(dataProperties).toHaveProperty("storageCleanup");
  });

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

  it("matches child reminder create and update nullability", () => {
    const createBody = record(
      contract(
        "POST",
        "/api/v1/child-profiles/:childProfileId/reminders"
      ).body
    );
    const createProperties = propertiesOf(createBody);

    expect(record(createProperties.dueAt).nullable).toBe(false);
    expect(record(createProperties.localTime).nullable).toBe(false);
    expect(record(createProperties.timezone).pattern).toBe(
      "^[A-Za-z_/-]+$"
    );
    expect(
      createChildProfileReminderBodySchema.safeParse({
        title: "Bez al",
        dueAt: null
      }).success
    ).toBe(false);

    const updateBody = record(
      contract(
        "PATCH",
        "/api/v1/child-profiles/:childProfileId/reminders/:reminderId"
      ).body
    );
    const updateProperties = propertiesOf(updateBody);

    expect(record(updateProperties.dueAt).nullable).toBe(true);
    expect(record(updateProperties.remindAt).nullable).toBe(false);
    expect(
      updateChildProfileReminderBodySchema.safeParse({
        dueAt: null
      }).success
    ).toBe(true);
    expect(
      updateChildProfileReminderBodySchema.safeParse({
        remindAt: null
      }).success
    ).toBe(false);
  });

  it("documents the product event discriminated union", () => {
    const body = record(
      contract("POST", "/api/v1/product-events").body
    );
    const variants = body.oneOf;

    expect(Array.isArray(variants)).toBe(true);
    expect(variants).toHaveLength(9);
    expect(record(body.discriminator).propertyName).toBe("eventType");
    expect(
      productEventBodySchema.safeParse({
        eventType: "search_performed",
        queryLength: 12,
        resultCount: 4,
        source: "search_results"
      }).success
    ).toBe(true);
    expect(
      productEventBodySchema.safeParse({
        eventType: "search_performed",
        listingId: "11111111-1111-4111-8111-111111111111"
      }).success
    ).toBe(false);
  });

  it("matches admin analytics query inputs and removes the ignored granularity field", () => {
    const query = record(
      contract("GET", "/api/v1/admin/analytics/overview").querystring
    );
    const properties = propertiesOf(query);

    expect(Object.keys(properties).sort()).toEqual(
      ["from", "to", "platform"].sort()
    );
    expect(record(properties.from).format).toBe("date");
    expect(
      adminAnalyticsQuerySchema.safeParse({
        from: "2030-01-01",
        to: "2030-01-31",
        platform: "web"
      }).success
    ).toBe(true);
    expect(
      adminAnalyticsQuerySchema.safeParse({
        granularity: "day"
      }).success
    ).toBe(false);
  });

  it("uses non-UUID RAG path parameters and strict reindex confirmation", () => {
    const chunksParams = record(
      contract(
        "GET",
        "/api/v1/admin/rag/documents/:documentId/chunks"
      ).params
    );
    const chunksProperties = propertiesOf(chunksParams);

    expect(record(chunksProperties.documentId).format).toBeUndefined();
    expect(record(chunksProperties.documentId).pattern).toBe(
      "^[a-z0-9][a-z0-9_-]{1,120}$"
    );

    const historyParams = record(
      contract(
        "GET",
        "/api/v1/admin/rag/eval/history/:runId"
      ).params
    );
    const historyProperties = propertiesOf(historyParams);

    expect(record(historyProperties.runId).format).toBeUndefined();
    expect(record(historyProperties.runId).pattern).toBe(
      "^[a-z0-9][a-z0-9-]{7,80}$"
    );

    const reindexBody = record(
      contract("POST", "/api/v1/admin/rag/reindex/run").body
    );
    const reindexProperties = propertiesOf(reindexBody);

    expect(record(reindexProperties.confirm).nullable).toBeUndefined();
  });

  it("publishes endpoint-specific response status sets", () => {
    expect(
      Object.keys(
        record(contract("POST", "/api/v1/product-events").response)
      ).sort()
    ).toEqual(["200", "400", "503"]);
    expect(
      Object.keys(
        record(contract("POST", "/api/v1/rag/search").response)
      ).sort()
    ).toEqual(["200", "400", "429", "503"]);
    expect(
      Object.keys(
        record(
          contract(
            "POST",
            "/api/v1/child-profiles/:childProfileId/reminders"
          ).response
        )
      ).sort()
    ).toEqual(["201", "400", "401", "403", "404", "503"]);
  });

  it("publishes exact auth and redirect response contracts", () => {
    expect(
      Object.keys(record(contract("POST", "/api/v1/auth/register").response)).sort()
    ).toEqual(["201", "400", "409", "429", "503"]);
    expect(
      Object.keys(
        record(contract("POST", "/api/v1/auth/login-approval/complete").response)
      ).sort()
    ).toEqual(["200", "202", "400", "503"]);
    expect(
      Object.keys(record(contract("GET", "/api/v1/auth/google/start").response)).sort()
    ).toEqual(["302", "503"]);
  });

  it("documents the listing image multipart field used by runtime", () => {
    const body = record(
      contract("POST", "/api/v1/listings/:id/images").body
    );
    const properties = propertiesOf(body);

    expect(Object.keys(properties)).toEqual(["image"]);
    expect(body.required).toEqual(["image"]);
  });

  it("publishes exact marketplace and messaging status contracts", () => {
    expect(
      Object.keys(
        record(contract("POST", "/api/v1/listings/:id/images").response)
      ).sort()
    ).toEqual(["201", "400", "401", "403", "404", "409", "413", "500", "503"]);
    expect(
      Object.keys(
        record(contract("POST", "/api/v1/checkout/mock-iyzico").response)
      ).sort()
    ).toEqual(["200", "400", "401", "402", "403", "409", "500", "503"]);
    expect(
      Object.keys(
        record(contract("POST", "/api/v1/conversations").response)
      ).sort()
    ).toEqual(["200", "201", "400", "401", "403", "500", "503"]);
  });

  it("keeps public share-link POST unauthenticated in the contract", () => {
    expect(
      contract("POST", "/api/v1/listings/:id/share-link").security
    ).toEqual([]);
  });

  it("publishes exact child notification and admin status contracts", () => {
    expect(
      Object.keys(
        record(
          contract(
            "DELETE",
            "/api/v1/child-profiles/:childProfileId/reminders/:reminderId"
          ).response
        )
      ).sort()
    ).toEqual(["200", "400", "401", "403", "404", "503"]);
    expect(
      Object.keys(
        record(contract("DELETE", "/api/v1/notifications/push-tokens").response)
      ).sort()
    ).toEqual(["200", "400", "401", "403", "404", "503"]);
    expect(
      Object.keys(
        record(
          contract(
            "POST",
            "/api/v1/admin/moderation/cases/:caseId/ai-summary"
          ).response
        )
      ).sort()
    ).toEqual(["200", "400", "401", "403", "404", "429", "503"]);
  });

  it("documents critical simple response payloads", () => {
    const shareResponse = record(
      record(contract("GET", "/api/v1/share-links/:code/resolve").response)["200"]
    );
    const shareData = propertiesOf(shareResponse);
    const sharePayload = propertiesOf(record(shareData.data));

    expect(record(sharePayload.targetPath).type).toBe("string");

    const logoutResponse = record(
      record(contract("POST", "/api/v1/auth/logout").response)["200"]
    );
    const logoutPayload = propertiesOf(record(propertiesOf(logoutResponse).data));

    expect(record(logoutPayload.loggedOut).enum).toEqual([true]);

    const unreadResponse = record(
      record(contract("GET", "/api/v1/notifications/unread-count").response)["200"]
    );
    const unreadPayload = propertiesOf(record(propertiesOf(unreadResponse).data));

    expect(record(unreadPayload.count).minimum).toBe(0);
  });

});
