
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  aiModelRuns,
  listingImages,
  listings,
  productCategories,
  profiles,
  users
} from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/app.js";
import type { CurrentUser } from "../src/plugins/auth.plugin.js";
import {
  addListingImage,
  createListing,
  getListingDetail,
  updateListing
} from "../src/services/listings.service.js";
import { getAdminListingDetail } from "../src/services/admin-listings.service.js";
import type { SafeImage } from "../src/services/image-safety.service.js";

const originalEnv = { ...process.env };

let app: FastifyInstance;
let uploadRoot: string;

beforeEach(async () => {
  uploadRoot = await mkdtemp(path.join(os.tmpdir(), "babyloop-authenticity-"));
  app = await createTestApp({ uploadRoot });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...originalEnv };

  await app.close();
  await rm(uploadRoot, { force: true, recursive: true });
});

describe("listing image authenticity integration", () => {
  it("rejects listing creation with client-provided imageUrls before any image row can be created", async () => {
    const { currentUser, profile } = await seedSeller("auth-create-bypass");
    const category = await seedCategory("auth-create-bypass");

    const result = await createListing(app, currentUser, {
      ...buildCreateListingBody(category.id),
      imageUrls: ["https://cdn.example.test/bypass.png"]
    } as Parameters<typeof createListing>[2] & { imageUrls: string[] });

    expect(result.status).toBe("image_urls_not_allowed");

    const createdListings = await app.db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.sellerProfileId, profile.id));

    expect(createdListings).toHaveLength(0);
  });

  it("rejects listing updates with client-provided imageUrls and preserves existing image rows", async () => {
    const { currentUser } = await seedSeller("auth-update-bypass");
    const category = await seedCategory("auth-update-bypass");
    const created = await createListing(app, currentUser, buildCreateListingBody(category.id));

    if (created.status !== "created") {
      throw new Error(`Listing setup failed with status ${created.status}`);
    }

    const result = await updateListing(app, currentUser, created.listing.id, {
      imageUrls: ["https://cdn.example.test/update-bypass.png"]
    } as Parameters<typeof updateListing>[3] & { imageUrls: string[] });

    expect(result.status).toBe("image_urls_not_allowed");

    const imageRows = await app.db
      .select({ id: listingImages.id })
      .from(listingImages)
      .where(eq(listingImages.listingId, created.listing.id));

    expect(imageRows).toHaveLength(0);
  });

  it("stores needs_review authenticity metadata, hides the image publicly, and exposes it to admin review", async () => {
    configureGeminiAuthenticityProvider();
    mockGeminiAuthenticityDecision("needs_review", 0.73);

    const { currentUser } = await seedSeller("auth-needs-review");
    const category = await seedCategory("auth-needs-review");
    const created = await createListing(app, currentUser, buildCreateListingBody(category.id));

    if (created.status !== "created") {
      throw new Error(`Listing setup failed with status ${created.status}`);
    }

    const upload = await addListingImage(app, currentUser, {
      image: await createSafePngImage(),
      listingId: created.listing.id,
      originalFilename: "needs-review.png",
      uploadRoot
    });

    expect(upload.status).toBe("created");

    const [authenticityRun] = await app.db
      .select({
        confidenceScore: aiModelRuns.confidenceScore,
        errorMessage: aiModelRuns.errorMessage,
        feature: aiModelRuns.feature,
        input: aiModelRuns.input,
        modelName: aiModelRuns.modelName,
        output: aiModelRuns.output,
        promptVersion: aiModelRuns.promptVersion,
        providerName: aiModelRuns.providerName,
        status: aiModelRuns.status
      })
      .from(aiModelRuns);

    expect(authenticityRun).toMatchObject({
      errorMessage: null,
      feature: "listing_image_authenticity",
      modelName: "gemini-test-model",
      promptVersion: "listing_image_authenticity.gemini.v1",
      providerName: "gemini-listing-image-authenticity",
      status: "success"
    });
    expect(Number(authenticityRun?.confidenceScore)).toBeCloseTo(0.73, 2);
    expect(authenticityRun?.input).toMatchObject({
      contentType: "image/png",
      originalFilename: "needs-review.png"
    });
    expect(authenticityRun?.output).toMatchObject({
      decision: "needs_review",
      reasonCount: 1
    });

    const serializedAuditInput = JSON.stringify(authenticityRun?.input ?? {});
    expect(serializedAuditInput).not.toContain("base64");
    expect(serializedAuditInput).not.toContain("Audit stroller");
    expect(serializedAuditInput).not.toContain("description");

    if (upload.status !== "created") {
      throw new Error(`Upload failed with status ${upload.status}`);
    }

    expect(upload.image.reviewStatus).toBe("needs_review");

    const [storedImage] = await app.db
      .select({
        authenticityConfidence: listingImages.authenticityConfidence,
        authenticityDecision: listingImages.authenticityDecision,
        authenticityProvider: listingImages.authenticityProvider,
        reviewStatus: listingImages.reviewStatus
      })
      .from(listingImages)
      .where(eq(listingImages.id, upload.image.id));

    expect(storedImage).toMatchObject({
      authenticityDecision: "needs_review",
      authenticityProvider: "gemini-listing-image-authenticity",
      reviewStatus: "needs_review"
    });
    expect(Number(storedImage?.authenticityConfidence)).toBeCloseTo(0.73);

    const publicDetail = await getListingDetail(app, created.listing.id);
    expect(publicDetail?.images).toEqual([]);

    const adminDetail = await getAdminListingDetail(app, created.listing.id);
    expect(adminDetail?.images).toHaveLength(1);
    expect(adminDetail?.images[0]).toMatchObject({
      id: upload.image.id,
      reviewStatus: "needs_review",
      authenticity: expect.objectContaining({
        decision: "needs_review",
        providerName: "gemini-listing-image-authenticity"
      })
    });
  });

  it("rejects provider-rejected images before storage and database insert", async () => {
    configureGeminiAuthenticityProvider();
    mockGeminiAuthenticityDecision("reject", 0.92);

    const { currentUser } = await seedSeller("auth-reject");
    const category = await seedCategory("auth-reject");
    const created = await createListing(app, currentUser, buildCreateListingBody(category.id));

    if (created.status !== "created") {
      throw new Error(`Listing setup failed with status ${created.status}`);
    }

    const upload = await addListingImage(app, currentUser, {
      image: await createSafePngImage(),
      listingId: created.listing.id,
      originalFilename: "ai-render.png",
      uploadRoot
    });

    expect(upload).toMatchObject({
      status: "authenticity_rejected"
    });

    const imageRows = await app.db
      .select({ id: listingImages.id })
      .from(listingImages)
      .where(eq(listingImages.listingId, created.listing.id));

    expect(imageRows).toHaveLength(0);
  });

  it("fails closed when the authenticity provider is unavailable and does not insert images", async () => {
    configureGeminiAuthenticityProvider();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("provider unavailable", { status: 503 }))
    );

    const { currentUser } = await seedSeller("auth-provider-fail");
    const category = await seedCategory("auth-provider-fail");
    const created = await createListing(app, currentUser, buildCreateListingBody(category.id));

    if (created.status !== "created") {
      throw new Error(`Listing setup failed with status ${created.status}`);
    }

    const upload = await addListingImage(app, currentUser, {
      image: await createSafePngImage(),
      listingId: created.listing.id,
      originalFilename: "provider-fail.png",
      uploadRoot
    });

    expect(upload).toMatchObject({
      status: "authenticity_unavailable"
    });

    const imageRows = await app.db
      .select({ id: listingImages.id })
      .from(listingImages)
      .where(eq(listingImages.listingId, created.listing.id));

    expect(imageRows).toHaveLength(0);
  });
});

async function createSafePngImage(): Promise<SafeImage> {
  const buffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: "#f8efe7"
    }
  })
    .png()
    .toBuffer();

  return {
    buffer,
    contentType: "image/png",
    extension: "png"
  };
}

async function seedSeller(label: string): Promise<{
  currentUser: CurrentUser;
  profile: { id: string };
}> {
  const unique = randomUUID();
  const [user] = await app.db
    .insert(users)
    .values({
      email: `${label}-${unique}@babyloop.test`,
      passwordHash: "test-password-hash"
    })
    .returning({
      id: users.id,
      email: users.email,
      role: users.role
    });

  if (!user) {
    throw new Error("User setup failed.");
  }

  const [profile] = await app.db
    .insert(profiles)
    .values({
      userId: user.id,
      displayName: `Seller ${label}`
    })
    .returning({
      id: profiles.id,
      displayName: profiles.displayName
    });

  if (!profile) {
    throw new Error("Profile setup failed.");
  }

  return {
    currentUser: {
      user,
      profile
    } as unknown as CurrentUser,
    profile
  };
}

async function seedCategory(label: string): Promise<{ id: string }> {
  const unique = randomUUID();
  const [category] = await app.db
    .insert(productCategories)
    .values({
      name: `Authenticity ${label}`,
      slug: `authenticity-${label}-${unique}`
    })
    .returning({
      id: productCategories.id
    });

  if (!category) {
    throw new Error("Category setup failed.");
  }

  return category;
}

function buildCreateListingBody(categoryId: string) {
  return {
    categoryId,
    condition: "good" as const,
    currency: "TRY",
    description: "Az kullanılmış gerçek ürün fotoğrafı ile ilan.",
    listingType: "sale" as const,
    priceAmount: "1250.00",
    title: "AI authenticity test ürünü"
  };
}

function configureGeminiAuthenticityProvider(): void {
  process.env.NODE_ENV = "test";
  process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER = "gemini";
  process.env.GEMINI_LISTING_IMAGE_AUTHENTICITY_MODEL = "gemini-test-model";
  process.env.GEMINI_API_KEY = "test-gemini-key";
}

function mockGeminiAuthenticityDecision(
  decision: "allow" | "needs_review" | "reject",
  confidence: number
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      decision,
                      confidence,
                      isGeneratedOrIllustration: decision === "reject",
                      isRealProductPhoto: decision !== "reject",
                      isRelevantToListing: decision !== "reject",
                      isStockOrCatalogLike: decision === "needs_review",
                      detectedObjects: ["stroller"],
                      categoryHints: ["baby gear"],
                      safetyFlags: {
                        containsChildFace: false,
                        containsLogoOrScreenshot: false,
                        containsMedicalProductClaim: false,
                        containsSensitiveChildContent: false
                      },
                      reasons: [
                        decision === "reject"
                          ? "Image appears generated or unrelated to the physical listing."
                          : "Image requires marketplace authenticity review."
                      ]
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
    )
  );
}
