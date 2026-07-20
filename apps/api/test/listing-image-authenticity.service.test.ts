
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { analyzeListingImageAuthenticity } from "../src/services/listing-image-authenticity.service.js";
import type { SafeImage } from "../src/services/image-safety.service.js";

const originalEnv = { ...process.env };

const fakeApp = {
  log: {
    warn: () => undefined
  }
} as unknown as FastifyInstance;

const safeImage: SafeImage = {
  buffer: Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x00
  ]),
  contentType: "image/png",
  extension: "png"
};

const baseInput = {
  categoryName: "Bebek Arabası",
  description: "Az kullanılmış gerçek ürün.",
  image: safeImage,
  listingId: "00000000-0000-4000-8000-000000000001",
  originalFilename: "stroller.png",
  title: "Bebek arabası"
};

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe("listing image authenticity provider", () => {
  it("allows mock provider outside production for local and test execution", async () => {
    process.env.NODE_ENV = "test";
    process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER = "mock";

    const result = await analyzeListingImageAuthenticity(fakeApp, baseInput);

    expect(result).toMatchObject({
      status: "completed",
      decision: "allow",
      providerName: "mock-listing-image-authenticity"
    });
  });

  it("rejects mock provider in production fail-closed", async () => {
    process.env.NODE_ENV = "production";
    process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER = "mock";

    const result = await analyzeListingImageAuthenticity(fakeApp, baseInput);

    expect(result).toMatchObject({
      status: "unavailable",
      providerName: "mock-listing-image-authenticity"
    });

    if (result.status === "unavailable") {
      expect(result.reason).toContain("production");
    }
  });

  it("fails closed when provider is not configured outside test", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER;
    delete process.env.GEMINI_API_KEY;

    const result = await analyzeListingImageAuthenticity(fakeApp, baseInput);

    expect(result).toMatchObject({
      status: "unavailable",
      providerName: "unconfigured-listing-image-authenticity"
    });
  });

  it("fails closed when Gemini provider is configured without API key", async () => {
    process.env.NODE_ENV = "production";
    process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER = "gemini";
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const result = await analyzeListingImageAuthenticity(fakeApp, baseInput);

    expect(result).toMatchObject({
      status: "unavailable",
      providerName: "gemini-listing-image-authenticity"
    });

    if (result.status === "unavailable") {
      expect(result.reason).toContain("GEMINI_API_KEY");
    }
  });

  it("times out Gemini provider fail-closed", async () => {
    process.env.NODE_ENV = "production";
    process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "sk-test";
    process.env.LISTING_IMAGE_AUTHENTICITY_MODEL = "gpt-test";
    process.env.LISTING_IMAGE_AUTHENTICITY_TIMEOUT_MS = "1";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      const signal = init?.signal as AbortSignal | undefined;

      return new Promise<Response>((_resolve, reject) => {
        const rejectWithAbort = () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        };

        if (signal?.aborted) {
          rejectWithAbort();
          return;
        }

        signal?.addEventListener("abort", rejectWithAbort, { once: true });
      });
    });

    const result = await analyzeListingImageAuthenticity(fakeApp, baseInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "unavailable",
      providerName: "gemini-listing-image-authenticity"
    });

    if (result.status === "unavailable") {
      expect(result.reason).toContain("timed out");
    }
  });

  it("uses Gemini provider and normalizes JSON response", async () => {
    process.env.NODE_ENV = "production";
    process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.GEMINI_LISTING_IMAGE_AUTHENTICITY_MODEL = "gemini-test-model";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      decision: "needs_review",
                      confidence: 0.72,
                      isGeneratedOrIllustration: false,
                      isRealProductPhoto: true,
                      isRelevantToListing: true,
                      isStockOrCatalogLike: true,
                      prohibitedProductCode: null,
                      prohibitedProductConfidence: 0.02,
                      prohibitedProductDetected: false,
                      detectedObjects: ["stroller"],
                      categoryHints: ["baby gear"],
                      safetyFlags: {
                        containsChildFace: false,
                        containsLogoOrScreenshot: false,
                        containsMedicalProductClaim: false,
                        containsSensitiveChildContent: false
                      },
                      reasons: ["Image looks like a real product photo but may be catalog-like."]
                    })
                  }
                ]
              }
            }
          ]
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      )
    );

    const result = await analyzeListingImageAuthenticity(fakeApp, baseInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "completed",
      decision: "needs_review",
      providerName: "gemini-listing-image-authenticity",
      modelName: "gemini-test-model",
      promptVersion: "listing_image_authenticity.gemini.v2"
    });
  });

  it("overrides an unsafe provider allow decision for a prohibited product", async () => {
    process.env.NODE_ENV = "production";
    process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                decision: "allow",
                confidence: 0.96,
                isGeneratedOrIllustration: false,
                isRealProductPhoto: true,
                isRelevantToListing: true,
                isStockOrCatalogLike: false,
                prohibitedProductCode: "weapon_or_ammunition",
                prohibitedProductConfidence: 0.94,
                prohibitedProductDetected: true,
                safetyFlags: {
                  containsSensitiveChildContent: false
                },
                reasons: ["The image contains a prohibited product."]
              })
            }]
          }
        }]
      }), { status: 200 })
    );

    const result = await analyzeListingImageAuthenticity(fakeApp, baseInput);

    expect(result).toMatchObject({
      status: "completed",
      decision: "reject",
      flags: {
        productPolicy: {
          action: "reject",
          policyVersion: "babyloop_listing_product_policy.v1",
          prohibitedProductCode: "weapon_or_ammunition"
        }
      }
    });
  });

  it("treats a valid prohibited-product code as detected when the provider boolean contradicts it", async () => {
    process.env.NODE_ENV = "production";
    process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                decision: "allow",
                confidence: 0.97,
                isGeneratedOrIllustration: false,
                isRealProductPhoto: true,
                isRelevantToListing: true,
                isStockOrCatalogLike: false,
                prohibitedProductCode: "recalled_or_banned_child_product",
                prohibitedProductConfidence: 0.91,
                prohibitedProductDetected: false,
                safetyFlags: {
                  containsSensitiveChildContent: false
                },
                reasons: ["The provider returned contradictory policy fields."]
              })
            }]
          }
        }]
      }), { status: 200 })
    );

    const result = await analyzeListingImageAuthenticity(fakeApp, baseInput);

    expect(result).toMatchObject({
      status: "completed",
      decision: "reject",
      flags: {
        productPolicy: {
          action: "reject",
          prohibitedProductCode: "recalled_or_banned_child_product",
          prohibitedProductConfidence: 0.91,
          prohibitedProductDetected: true
        }
      }
    });
  });

  it("times out Gemini provider fail-closed", async () => {
    process.env.NODE_ENV = "production";
    process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.GEMINI_LISTING_IMAGE_AUTHENTICITY_MODEL = "gemini-test-model";
    process.env.LISTING_IMAGE_AUTHENTICITY_TIMEOUT_MS = "1";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      const signal = init?.signal as AbortSignal | undefined;

      return new Promise<Response>((_resolve, reject) => {
        const rejectWithAbort = () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        };

        if (signal?.aborted) {
          rejectWithAbort();
          return;
        }

        signal?.addEventListener("abort", rejectWithAbort, { once: true });
      });
    });

    const result = await analyzeListingImageAuthenticity(fakeApp, baseInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "unavailable",
      providerName: "gemini-listing-image-authenticity"
    });

    if (result.status === "unavailable") {
      expect(result.reason).toContain("timed out");
    }
  });
});
