import { events } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { authHeader, createUser } from "./helpers/auth.js";

let app: TestApp;

describe("assistant API", () => {
  it("requires authentication for assistant chat and message endpoints", async () => {
    const chatResponse = await app.inject({
      method: "POST",
      url: "/api/v1/assistant/chat",
      payload: {
        mode: "safe_buying",
        content: "What should I check before buying a stroller?"
      }
    });

    const messageResponse = await app.inject({
      method: "POST",
      url: "/api/v1/assistant/messages",
      payload: {
        locale: "tr",
        message: "Bebek arabası alırken nelere dikkat etmeliyim?"
      }
    });

    expect(chatResponse.statusCode).toBe(401);
    expect(messageResponse.statusCode).toBe(401);
    expect(chatResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
    expect(messageResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns a curated assistant reply for authenticated users", async () => {
    const user = await createUser(app, { email: "assistant-chat-parent@babyloop.test" });

    const response = await app.inject({
      headers: authHeader(user.accessToken),
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
    const user = await createUser(app, { email: "assistant-age-parent@babyloop.test" });

    const response = await app.inject({
      headers: authHeader(user.accessToken),
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

  it("records privacy-safe assistant message product events without raw message text", async () => {
    const message = "Bebek arabası alırken nelere dikkat etmeliyim?";
    const user = await createUser(app, { email: "assistant-event-parent@babyloop.test" });

    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/assistant/messages",
      payload: {
        locale: "tr",
        message
      }
    });

    expect(response.statusCode).toBe(200);

    const [assistantEvent] = await app.db
      .select({
        actorProfileId: events.actorProfileId,
        entityId: events.entityId,
        entityType: events.entityType,
        eventType: events.eventType,
        metadata: events.metadata
      })
      .from(events)
      .where(eq(events.eventType, "product_assistant_message_sent"));

    expect(assistantEvent).toMatchObject({
      actorProfileId: user.profile.id,
      entityId: "00000000-0000-0000-0000-000000000000",
      entityType: "assistant",
      eventType: "product_assistant_message_sent"
    });
    expect(assistantEvent?.metadata).toEqual({
      authenticated: "true",
      locale: "tr",
      messageLength: message.length,
      source: "assistant"
    });
    expect(JSON.stringify(assistantEvent)).not.toContain(message);
    expect(JSON.stringify(assistantEvent)).not.toMatch(/password|accessToken|refreshToken|phone|email|messageBody|rawPrompt/iu);
  });

  it("rejects invalid assistant chat requests", async () => {
    const user = await createUser(app, { email: "assistant-invalid-parent@babyloop.test" });

    const response = await app.inject({
      headers: authHeader(user.accessToken),
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
