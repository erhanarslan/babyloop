import { describe, expect, it } from "vitest";

import {
  normalizeSavedSearchListPayload,
  normalizeSavedSearchPayload
} from "./saved-searches-api";

describe("saved search API normalization", () => {
  it("normalizes legacy flat saved-search payloads", () => {
    expect(
      normalizeSavedSearchPayload({
        id: "saved-1",
        name: "Bebek arabası",
        q: "bebek arabası",
        city: "İstanbul",
        sort: "newest",
        notificationsEnabled: true
      })
    ).toEqual({
      id: "saved-1",
      name: "Bebek arabası",
      filters: {
        q: "bebek arabası",
        city: "İstanbul",
        sort: "newest"
      },
      notificationEnabled: true
    });
  });

  it("normalizes nested filters and drops malformed items", () => {
    expect(
      normalizeSavedSearchListPayload({
        savedSearches: [
          {
            id: "saved-2",
            name: "Oto koltuğu",
            filters: {
              listingType: "donation",
              priceMax: "2500"
            }
          },
          {
            name: "Kimliksiz kayıt"
          }
        ]
      })
    ).toEqual([
      {
        id: "saved-2",
        name: "Oto koltuğu",
        filters: {
          listingType: "donation",
          priceMax: 2500
        }
      }
    ]);
  });
});
