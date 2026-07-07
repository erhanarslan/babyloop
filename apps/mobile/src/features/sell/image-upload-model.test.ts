import {
  buildMobileListingImageUploadFile,
  MOBILE_LISTING_IMAGE_LIMIT,
  getRemainingMobileListingImageSlots,
  normalizeMobileImageMimeType,
  validateMobileListingImageSelectionCount
} from "./image-upload-model";

describe("mobile listing image upload model", () => {
  it("builds a safe React Native multipart image file", () => {
    expect(
      buildMobileListingImageUploadFile({
        uri: "file:///tmp/Bebek Arabası.PNG",
        fileName: "Bebek Arabası.PNG",
        mimeType: "image/png"
      })
    ).toEqual({
      ok: true,
      file: {
        uri: "file:///tmp/Bebek Arabası.PNG",
        name: "Bebek-Arabas-.PNG",
        type: "image/png"
      }
    });
  });

  it("infers mime type from uri when picker does not provide it", () => {
    expect(
      buildMobileListingImageUploadFile({
        uri: "file:///tmp/stroller.webp"
      })
    ).toMatchObject({
      ok: true,
      file: {
        type: "image/webp"
      }
    });
  });

  it("rejects unsupported images", () => {
    expect(
      buildMobileListingImageUploadFile({
        uri: "file:///tmp/vector.svg",
        fileName: "vector.svg",
        mimeType: "image/svg+xml"
      })
    ).toEqual({
      ok: false,
      message: "Sadece JPG, PNG veya WEBP görsel yükleyebilirsin."
    });
  });

  it("normalizes image/jpg to image/jpeg", () => {
    expect(normalizeMobileImageMimeType("image/jpg")).toBe("image/jpeg");
  });

  it("caps mobile listing image selection at five photos", () => {
    expect(MOBILE_LISTING_IMAGE_LIMIT).toBe(5);
    expect(getRemainingMobileListingImageSlots(3)).toBe(2);
    expect(validateMobileListingImageSelectionCount(3, 2)).toEqual({
      ok: true,
      remainingSlots: 2
    });
  });

  it("rejects image selections beyond the remaining slots", () => {
    expect(validateMobileListingImageSelectionCount(4, 2)).toEqual({
      ok: false,
      message: "En fazla 5 fotoğraf ekleyebilirsin. 1 fotoğraf daha seçebilirsin.",
      remainingSlots: 1
    });

    expect(validateMobileListingImageSelectionCount(5, 1)).toEqual({
      ok: false,
      message: "En fazla 5 fotoğraf ekleyebilirsin.",
      remainingSlots: 0
    });
  });
});
