import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getEmailProviderConfig,
  getEmailProviderPreview,
  sendEmailDraft,
  type EmailDraft,
  type SmtpEmailProviderConfig
} from "../src/services/email-provider.service.js";

const draft: EmailDraft = {
  intent: "security_alert",
  to: "parent@example.test",
  subject: "BabyLoop security test",
  text: "BabyLoop email provider smoke body"
};

describe("email provider service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("defaults to mock sandbox mode", () => {
    expect(getEmailProviderConfig({})).toEqual({
      driver: "mock",
      sendEnabled: false,
      from: null
    });

    expect(getEmailProviderPreview({})).toMatchObject({
      driver: "mock",
      sendEnabled: false,
      fromConfigured: false,
      providerConfigured: false,
      sandboxOnly: true,
      missing: []
    });
  });

  it("previews SMTP without leaking username or password", () => {
    const preview = getEmailProviderPreview({
      EMAIL_PROVIDER: "smtp",
      EMAIL_FROM: "BabyLoop <hello@example.test>",
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "587",
      SMTP_USER: "smtp-user",
      SMTP_PASS: "smtp-secret",
      EMAIL_SEND_ENABLED: "true"
    });

    expect(preview).toMatchObject({
      driver: "smtp",
      sendEnabled: true,
      fromConfigured: true,
      providerConfigured: true,
      sandboxOnly: false,
      missing: []
    });
    expect(JSON.stringify(preview)).not.toContain("smtp-user");
    expect(JSON.stringify(preview)).not.toContain("smtp-secret");
  });

  it("sends through SMTP when SMTP sending is enabled", async () => {
    const sentMessages: Array<{
      from: string;
      to: string;
      subject: string;
      text: string;
    }> = [];

    const result = await sendEmailDraft(
      draft,
      {
        EMAIL_PROVIDER: "smtp",
        EMAIL_FROM: "BabyLoop <hello@example.test>",
        SMTP_HOST: "smtp.example.test",
        SMTP_PORT: "587",
        SMTP_USER: "smtp-user",
        SMTP_PASS: "smtp-secret",
        EMAIL_SEND_ENABLED: "true"
      },
      (config: SmtpEmailProviderConfig) => {
        expect(config.username).toBe("smtp-user");
        expect(config.password).toBe("smtp-secret");

        return {
          async sendMail(message) {
            sentMessages.push(message);
            return { messageId: "smtp-message-id" };
          }
        };
      }
    );

    expect(result).toEqual({
      sent: true,
      provider: "smtp",
      sandboxOnly: false,
      messageId: "smtp-message-id"
    });
    expect(sentMessages).toEqual([
      {
        from: "BabyLoop <hello@example.test>",
        to: "parent@example.test",
        subject: "BabyLoop security test",
        text: "BabyLoop email provider smoke body"
      }
    ]);
    expect(JSON.stringify(result)).not.toContain("smtp-secret");
  });

  it("previews Resend without leaking the API key", () => {
    const preview = getEmailProviderPreview({
      EMAIL_PROVIDER: "resend",
      EMAIL_FROM: "BabyLoop <hello@example.test>",
      RESEND_API_KEY: "re_secret_key",
      EMAIL_SEND_ENABLED: "true"
    });

    expect(preview).toMatchObject({
      driver: "resend",
      sendEnabled: true,
      fromConfigured: true,
      providerConfigured: true,
      sandboxOnly: false,
      missing: []
    });
    expect(JSON.stringify(preview)).not.toContain("re_secret_key");
  });

  it("sends through Resend when Resend sending is enabled", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      return {
        ok: true,
        json: async () => ({ id: "resend-message-id" })
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmailDraft(draft, {
      EMAIL_PROVIDER: "resend",
      EMAIL_FROM: "BabyLoop <hello@example.test>",
      RESEND_API_KEY: "re_secret_key",
      EMAIL_SEND_ENABLED: "true"
    });

    expect(result).toEqual({
      sent: true,
      provider: "resend",
      sandboxOnly: false,
      messageId: "resend-message-id"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.resend.com/emails");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers as HeadersInit);

    expect(init.method).toBe("POST");
    expect(headers.get("authorization")).toBe("Bearer re_secret_key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(String(init.body)).toContain("BabyLoop security test");
    expect(String(init.body)).toContain("parent@example.test");
    expect(JSON.stringify(result)).not.toContain("re_secret_key");
  });

  it("keeps Resend in sandbox when sending is disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmailDraft(draft, {
      EMAIL_PROVIDER: "resend",
      EMAIL_FROM: "BabyLoop <hello@example.test>",
      RESEND_API_KEY: "re_secret_key",
      EMAIL_SEND_ENABLED: "false"
    });

    expect(result).toEqual({
      sent: false,
      provider: "resend",
      sandboxOnly: true,
      reason: "email_delivery_disabled"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails fast when real Resend sending is enabled without an API key", () => {
    expect(() =>
      getEmailProviderConfig({
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "BabyLoop <hello@example.test>",
        EMAIL_SEND_ENABLED: "true"
      })
    ).toThrow("RESEND_API_KEY is required when EMAIL_PROVIDER=resend and EMAIL_SEND_ENABLED=true.");
  });

  it("fails fast when real SMTP sending is enabled without credentials", () => {
    expect(() =>
      getEmailProviderConfig({
        EMAIL_PROVIDER: "smtp",
        EMAIL_FROM: "BabyLoop <hello@example.test>",
        SMTP_HOST: "smtp.example.test",
        SMTP_PORT: "587",
        EMAIL_SEND_ENABLED: "true"
      })
    ).toThrow("SMTP_USER and SMTP_PASS are required when EMAIL_PROVIDER=smtp and EMAIL_SEND_ENABLED=true.");
  });

  it("rejects mock provider when sending is enabled", () => {
    expect(() =>
      getEmailProviderConfig({
        EMAIL_PROVIDER: "mock",
        EMAIL_SEND_ENABLED: "true"
      })
    ).toThrow("EMAIL_SEND_ENABLED=true requires EMAIL_PROVIDER=smtp or EMAIL_PROVIDER=resend.");
  });

  it("rejects unsupported providers", () => {
    expect(() => getEmailProviderConfig({ EMAIL_PROVIDER: "mailgun" })).toThrow(
      "EMAIL_PROVIDER must be mock, smtp, or resend."
    );
  });

  it("rejects invalid port and boolean env values", () => {
    expect(() =>
      getEmailProviderConfig({
        EMAIL_PROVIDER: "smtp",
        EMAIL_FROM: "BabyLoop <hello@example.test>",
        SMTP_HOST: "smtp.example.test",
        SMTP_PORT: "not-a-port"
      })
    ).toThrow("SMTP_PORT must be a valid TCP port.");

    expect(() =>
      getEmailProviderConfig({
        EMAIL_PROVIDER: "smtp",
        EMAIL_FROM: "BabyLoop <hello@example.test>",
        SMTP_HOST: "smtp.example.test",
        SMTP_PORT: "587",
        SMTP_SECURE: "maybe"
      })
    ).toThrow("Boolean env values must be true or false.");

    expect(() =>
      getEmailProviderConfig({
        EMAIL_PROVIDER: "smtp",
        EMAIL_FROM: "BabyLoop <hello@example.test>",
        SMTP_HOST: "smtp.example.test",
        SMTP_PORT: "587",
        EMAIL_SEND_ENABLED: "maybe"
      })
    ).toThrow("EMAIL_SEND_ENABLED must be true or false.");
  });
});
