import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  buildCanonicalUrl,
  getSiteUrl
} from "../lib/seo";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/brand/apple-icon.png", sizes: "180x180", type: "image/png" }
    ]
  },
  alternates: {
    canonical: buildCanonicalUrl("/")
  },
  openGraph: {
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    url: buildCanonicalUrl("/"),
    images: [
      {
        url: buildCanonicalUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} marketplace preview`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [buildCanonicalUrl("/opengraph-image")]
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="babyloop-global-pattern" aria-hidden="true" />
        <div className="babyloop-app-content">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
