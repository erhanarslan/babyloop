import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { PageContainer, SiteShell } from "../../../components/ui";
import { ChangePasswordForm } from "../../../features/auth/change-password-form";
import { getApiBaseUrl } from "../../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Şifre değiştir",
  "BabyLoop şifre değiştirme sayfası özel alandır ve indekslenmez."
);

export default function AccountPasswordPage() {
  return (
    <SiteShell>
      <PageContainer className="pb-12 pt-5" ariaLabel="Şifre değiştir">
        <section className="mx-auto grid w-full max-w-3xl gap-4">
          <div className="rounded-[1.25rem] border border-border/70 bg-background p-4">
            <p className="eyebrow">Hesap güvenliği</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Şifre değiştir</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
              Şifreni düzenli aralıklarla yenileyebilirsin. MFA ve login approval ayarları mobil güvenlik akışında yönetilir.
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border/70 bg-background p-4">
            <ChangePasswordForm apiBaseUrl={getApiBaseUrl()} />
          </div>
        </section>
      </PageContainer>
    </SiteShell>
  );
}
