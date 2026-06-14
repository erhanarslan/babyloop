import type { MetadataRoute } from "next";
import { getSiteUrl } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/browse",
          "/categories",
          "/listings",
          "/guides",
          "/assistant"
        ],
        disallow: [
          "/admin",
          "/account",
          "/auth",
          "/conversations",
          "/favorites",
          "/forgot-password",
          "/login",
          "/my-listings",
          "/notifications",
          "/register",
          "/reset-password",
          "/sell"
        ]
      }
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
    host: getSiteUrl()
  };
}
