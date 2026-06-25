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
  description: "Dedicated BabyLoop backoffice application.",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
