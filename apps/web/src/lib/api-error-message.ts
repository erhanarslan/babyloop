import type { ApiFailure } from "@babyloop/shared";
import type { Dictionary } from "./i18n/dictionaries";

export type ApiError = ApiFailure["error"];

export function getApiErrorMessage(
  error: ApiError,
  dictionary: Dictionary,
  fallback: string = dictionary.common.requestFailed
): string {
  if (error.code === "API_UNAVAILABLE" || error.code === "AUTH_UNAVAILABLE") {
    return dictionary.common.apiUnavailable;
  }

  if (error.code === "UNAUTHORIZED") {
    return dictionary.common.loginRequired;
  }

  if (error.code === "FORBIDDEN") {
    return dictionary.common.accessDenied;
  }

  if (error.code === "NOT_FOUND") {
    return dictionary.common.notFound;
  }

  if (error.code === "MESSAGE_BLOCKED") {
    return dictionary.messaging.messageBlocked;
  }

  if (error.code === "INVALID_MESSAGE_BODY") {
    return dictionary.messaging.invalidMessageBody;
  }

  if (error.code === "INVALID_IMAGE") {
    return dictionary.listings.unsupportedImageType;
  }

  if (error.code === "IMAGE_TOO_LARGE") {
    return dictionary.listings.imageTooLarge;
  }

  if (error.code === "TOO_MANY_IMAGES") {
    return dictionary.listings.tooManyImages;
  }

  return fallback;
}
