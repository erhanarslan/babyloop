import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { PageContainer, SiteShell } from "../../../components/ui";
import { ChangePasswordForm } from "../../../features/auth/change-password-form";
import { MfaSettingsPanel } from "../../../features/auth/mfa-settings-panel";
import { SessionManagementPanel } from "../../../features/auth/session-management-panel";
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
              {[
                ["Şifre", "#password"],
                ["OTP / MFA", "#mfa"],
                ["Aktif cihazlar", "#sessions"]
              ].map(([item, href], index) => (
                <a
                  className={[
                    "min-w-[150px] rounded-2xl border px-3 py-2 text-sm font-black lg:min-w-0",
                    index === 0
                      ? "border-primary/40 bg-background text-primary shadow-sm"
                      : "border-transparent text-foreground"
                  ].join(" ")}
                  href={href}
                  key={item}
                >
                  {item}
                </a>
              ))}
            </nav>
          </aside>
          <div className="grid min-w-0 gap-4">
            <div className="rounded-[1.25rem] border border-border/70 bg-background p-4">
              <h1 className="text-2xl font-black tracking-tight text-foreground">Güvenlik ve şifre</h1>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Şifreni, e-posta OTP doğrulamasını ve aktif cihaz oturumlarını buradan yönet.
              </p>
            </div>
            <div id="password" className="rounded-[1.25rem] border border-border/70 bg-background p-4">
              <ChangePasswordForm apiBaseUrl={getApiBaseUrl()} />
            </div>
            <section className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-muted/20 p-4">
              <div id="mfa">
                <MfaSettingsPanel apiBaseUrl={getApiBaseUrl()} />
              </div>
              <div id="sessions">
                <SessionManagementPanel apiBaseUrl={getApiBaseUrl()} />
              </div>
            </section>
          </div>
        </section>
      </PageContainer>
    </SiteShell>
  );
}
