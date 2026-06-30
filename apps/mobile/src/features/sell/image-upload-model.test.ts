import {
  buildMobileListingImageUploadFile,
  normalizeMobileImageMimeType
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
});
