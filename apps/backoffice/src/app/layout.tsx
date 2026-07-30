import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "../styles/00-admin-tokens-base.css";
import "../styles/10-admin-layout.css";
import "../styles/20-admin-auth.css";
import "../styles/30-admin-components.css";
import "../styles/40-admin-pages.css";

export const metadata: Metadata = {
  title: "BabyLoop Backoffice",
  description: "BabyLoop operasyon ve yönetim konsolu",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
