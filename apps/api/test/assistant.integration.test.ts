import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

let app: TestApp;

describe("assistant API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns a curated assistant reply without authentication", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/assistant/chat",
      payload: {
        mode: "safe_buying",
        content: "What should I check before buying a stroller?"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        reply: {
          mode: "safe_buying",
          providerName: "curated-assistant",
          promptVersion: "assistant-chat-v1",
          topic: {
            id: "baby-gear-safety"
          }
        }
      }
    });

    const reply = response.json<{
      ok: true;
      data: {
        reply: {
          actions: unknown[];
          safetyDisclaimers: string[];
          confidenceScore: number;
        };
      };
    }>().data.reply;

    expect(reply.actions.length).toBeGreaterThan(0);
    expect(reply.safetyDisclaimers.length).toBeGreaterThan(0);
    expect(reply.confidenceScore).toBeGreaterThan(0);
  });

  it("returns age-band guidance for toddler needs", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/assistant/chat",
      payload: {
        mode: "age_needs",
        content: "My child is around 12-24 months. What should I look for?"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        reply: {
          mode: "age_needs",
          topic: {
            id: "toddler-mobility"
          }
        }
      }
    });
  });

  it("rejects invalid assistant chat requests", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/assistant/chat",
      payload: {
        mode: "unknown",
        content: ""
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_ASSISTANT_CHAT_REQUEST"
      }
    });
  });
});
