import type { Metadata } from "next";
import { SiteShell } from "../../components/ui";
import { CartPageContent } from "../../features/cart/cart-page-content";
import { getApiBaseUrl } from "../../lib/api";
import { buildNoIndexMetadata } from "../../lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Sepetim",
  "BabyLoop sepet ve demo checkout sayfası özel alandır ve indekslenmez."
);

export default function CartPage() {
  return (
    <SiteShell>
      <CartPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}
