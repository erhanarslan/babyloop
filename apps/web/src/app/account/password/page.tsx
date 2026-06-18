import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { PageContainer, SiteShell } from "../../../components/ui";
import { ChangePasswordForm } from "../../../features/auth/change-password-form";
import { getApiBaseUrl } from "../../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Güvenlik ve şifre",
  "BabyLoop güvenlik sayfaları özel alandır ve indekslenmez."
);

export default function AccountPasswordPage() {
  return (
    <SiteShell>
      <PageContainer className="pb-12 pt-5" ariaLabel="Güvenlik ve şifre">
        <section className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="self-start rounded-[1.25rem] border border-border/70 bg-muted/25 p-3">
            <nav aria-label="Güvenlik bölümleri" className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
              {["Şifre", "Oturumlar", "OTP / MFA", "Mobil onay", "Güvenilen cihazlar"].map((item, index) => (
                <span
                  className={[
                    "min-w-[150px] rounded-2xl border px-3 py-2 text-sm font-black lg:min-w-0",
                    index === 0
                      ? "border-primary/40 bg-background text-primary shadow-sm"
                      : "border-transparent text-foreground"
                  ].join(" ")}
                  key={item}
                >
                  {item}
                </span>
              ))}
            </nav>
          </aside>
          <div className="grid min-w-0 gap-4">
            <div className="rounded-[1.25rem] border border-border/70 bg-background p-4">
              <h1 className="text-2xl font-black tracking-tight text-foreground">Güvenlik ve şifre</h1>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Şifreni güncelle ve yakında gelecek güvenlik seçeneklerini takip et.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-background p-4">
              <ChangePasswordForm apiBaseUrl={getApiBaseUrl()} />
            </div>
            <section className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-muted/20 p-4">
              <DisabledSecurityRow label="OTP / MFA" />
              <DisabledSecurityRow label="Mobil onay" />
              <DisabledSecurityRow label="Güvenilen cihazlar" />
            </section>
          </div>
        </section>
      </PageContainer>
    </SiteShell>
  );
}

function DisabledSecurityRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm font-black text-foreground">{label}</strong>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-black text-muted-foreground">
            Yakında
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Bu güvenlik seçeneği hazır olduğunda buradan yönetilecek.
        </p>
      </div>
      <button
        aria-label={`${label} yakında`}
        className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted opacity-70"
        disabled
        type="button"
      >
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-background shadow-sm" />
      </button>
    </div>
  );
}
