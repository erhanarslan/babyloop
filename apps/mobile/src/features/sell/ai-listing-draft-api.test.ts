import {
  buildMobileAiListingDraftFormData,
  fetchMobileAiListingDraftSuggestion,
  normalizeMobileAiListingDraftSuggestion
} from "./ai-listing-draft-api";
import { mobileAuthFetch } from "../auth/auth-api";
import { createDefaultMobileSellFormState } from "./sell-form-model";

jest.mock("../auth/auth-api", () => ({
  mobileAuthFetch: jest.fn()
}));

const mobileAuthFetchMock = mobileAuthFetch as jest.MockedFunction<typeof mobileAuthFetch>;

describe("mobile AI listing draft api", () => {
  afterEach(() => {
    mobileAuthFetchMock.mockReset();
    jest.resetModules();
  });

  it("posts multipart FormData to the listings AI draft endpoint without manual multipart headers", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          suggestion: {
            title: "Temiz bebek arabası",
            description: "Katlanabilir bebek arabası.",
            categoryId: "category-1",
            condition: "good",
            imageFeedback: [
              {
                imageIdOrUrl: "image-1",
                status: "good",
                message: "Ürün net görünüyor."
              }
            ],
            missingDetails: ["Marka/model"],
            warnings: ["Güvenlik durumunu satıcı doğrulamalı."],
            confidence: "medium",
            providerName: "provider",
            promptVersion: "v2",
            modelName: "model"
          }
        }
      })
    } as Response);

    const suggestion = await fetchMobileAiListingDraftSuggestion({
      city: "İstanbul",
      formState: {
        ...createDefaultMobileSellFormState(),
        categoryId: "category-1",
        title: "Bebek arabası"
      },
      selectedImages: [
        {
          uri: "file:///image-1.jpg",
          fileName: "image-1.jpg",
          mimeType: "image/jpeg"
        },
        {
          uri: "file:///image-2.png",
          fileName: "image-2.png",
          mimeType: "image/png"
        }
      ]
    });

    const [path, init] = mobileAuthFetchMock.mock.calls[0]!;

    expect(path).toBe("/api/v1/listings/ai-draft-suggestions");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(new Headers(init?.headers).get("content-type") ?? "").not.toMatch(/multipart/iu);
    expect(suggestion).toMatchObject({
      title: "Temiz bebek arabası",
      condition: "good",
      confidence: "medium"
    });
    expect(JSON.stringify(suggestion)).not.toMatch(/providerName|modelName|promptVersion|base64|accessToken|refreshToken|cookie/iu);
  });

  it("limits multipart images to five and reuses mobile image normalization", () => {
    const formData = buildMobileAiListingDraftFormData({
      formState: createDefaultMobileSellFormState(),
      selectedImages: Array.from({ length: 6 }, (_, index) => ({
        uri: `file:///image-${index}.jpg`,
        fileName: `image-${index}.jpg`,
        mimeType: "image/jpeg"
      }))
    });
    const parts = readFormDataEntries(formData);

    expect(parts.filter((part) => part[0] === "images")).toHaveLength(5);
  });

  it("throws controlled errors for invalid images before network upload", () => {
    expect(() => buildMobileAiListingDraftFormData({
      formState: createDefaultMobileSellFormState(),
      selectedImages: [
        {
          uri: "file:///bad.gif",
          fileName: "bad.gif",
          mimeType: "image/gif"
        }
      ]
    })).toThrow("Sadece JPG, PNG veya WEBP görsel yükleyebilirsin.");
  });

  it("normalizes and rejects structured responses safely", () => {
    expect(normalizeMobileAiListingDraftSuggestion({
      title: "Başlık",
      description: "Açıklama",
      categoryId: "category-1",
      condition: "needs_repair",
      priceSuggestion: {
        min: 100,
        max: 200,
        confidence: "high",
        reason: "Yaklaşık aralık"
      },
      imageFeedback: [
        {
          imageIdOrUrl: "data:image/png;base64,raw",
          status: "unknown",
          message: "Kontrol et."
        }
      ],
      missingDetails: ["Telefon yazma test@example.test"],
      warnings: ["sk-secret görülmemeli"],
      confidence: "high",
      providerName: "provider"
    })).toMatchObject({
      title: "Başlık",
      condition: "needs_repair",
      confidence: "high",
      priceSuggestion: {
        min: 100,
        max: 200,
        currency: "TRY"
      },
      missingDetails: ["Telefon yazma [redacted-email]"],
      warnings: ["[redacted-token] görülmemeli"]
    });
    expect(normalizeMobileAiListingDraftSuggestion({
      imageFeedback: [
        {
          imageIdOrUrl: "data:image/png;base64,raw",
          message: "Kontrol et."
        }
      ]
    })?.imageFeedback).toEqual([]);
    expect(normalizeMobileAiListingDraftSuggestion(null)).toBeNull();
  });
});

function readFormDataEntries(formData: FormData): Array<[string, unknown]> {
  const formDataLike = formData as unknown as {
    _parts?: Array<[string, unknown]>;
    entries?: () => Iterable<[string, unknown]>;
  };

  if (typeof formDataLike.entries === "function") {
    return Array.from(formDataLike.entries());
  }

  return formDataLike._parts ?? [];
}
