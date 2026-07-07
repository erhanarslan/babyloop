export type MobilePickedImageInput = {
  uri?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export type MobileListingImageUploadFile = {
  uri: string;
  name: string;
  type: "image/jpeg" | "image/png" | "image/webp";
};

export type MobileListingImageUploadResult =
  | {
      ok: true;
      file: MobileListingImageUploadFile;
    }
  | {
      ok: false;
      message: string;
    };

export const MOBILE_LISTING_IMAGE_LIMIT = 5;

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export function getRemainingMobileListingImageSlots(currentCount: number): number {
  return Math.max(0, MOBILE_LISTING_IMAGE_LIMIT - Math.max(0, Math.trunc(currentCount)));
}

export function validateMobileListingImageSelectionCount(
  currentCount: number,
  incomingCount: number
):
  | {
      ok: true;
      remainingSlots: number;
    }
  | {
      ok: false;
      message: string;
      remainingSlots: number;
    } {
  const remainingSlots = getRemainingMobileListingImageSlots(currentCount);

  if (remainingSlots <= 0) {
    return {
      ok: false,
      message: `En fazla ${MOBILE_LISTING_IMAGE_LIMIT} fotoğraf ekleyebilirsin.`,
      remainingSlots
    };
  }

  if (incomingCount > remainingSlots) {
    return {
      ok: false,
      message: `En fazla ${MOBILE_LISTING_IMAGE_LIMIT} fotoğraf ekleyebilirsin. ${remainingSlots} fotoğraf daha seçebilirsin.`,
      remainingSlots
    };
  }

  return {
    ok: true,
    remainingSlots
  };
}

export function buildMobileListingImageUploadFile(
  image: MobilePickedImageInput | null
): MobileListingImageUploadResult {
  const uri = image?.uri?.trim();

  if (!uri) {
    return {
      ok: false,
      message: "Görsel seçilemedi."
    };
  }

  const inferredType = normalizeMobileImageMimeType(image?.mimeType ?? inferMimeTypeFromUri(uri));

  if (!inferredType) {
    return {
      ok: false,
      message: "Sadece JPG, PNG veya WEBP görsel yükleyebilirsin."
    };
  }

  return {
    ok: true,
    file: {
      uri,
      name: sanitizeMobileImageFileName(image?.fileName, inferredType),
      type: inferredType
    }
  };
}

export function normalizeMobileImageMimeType(
  value: string | null | undefined
): MobileListingImageUploadFile["type"] | null {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "image/jpg") {
    return "image/jpeg";
  }

  return allowedImageTypes.includes(normalized as MobileListingImageUploadFile["type"])
    ? (normalized as MobileListingImageUploadFile["type"])
    : null;
}

function inferMimeTypeFromUri(uri: string): string | null {
  const cleanUri = uri.split("?")[0]?.toLowerCase() ?? "";

  if (cleanUri.endsWith(".jpg") || cleanUri.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (cleanUri.endsWith(".png")) {
    return "image/png";
  }

  if (cleanUri.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}

function sanitizeMobileImageFileName(
  fileName: string | null | undefined,
  type: MobileListingImageUploadFile["type"]
): string {
  const extension = type === "image/jpeg" ? "jpg" : type.replace("image/", "");
  const fallback = `listing-image.${extension}`;
  const rawName = fileName?.trim() || fallback;
  const safeName = rawName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/g, "")
    .slice(0, 80);

  if (!safeName) {
    return fallback;
  }

  if (safeName.toLowerCase().endsWith(`.${extension}`)) {
    return safeName;
  }

  return `${safeName}.${extension}`;
}
