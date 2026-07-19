import { PageContainer } from "../../components/ui";
import { ChangePasswordForm } from "../auth/change-password-form";
import { MfaSettingsPanel } from "../auth/mfa-settings-panel";
import { SessionManagementPanel } from "../auth/session-management-panel";

type AccountSecurityPageContentProps = {
  apiBaseUrl: string;
};

const securitySections = [
  { href: "#password", label: "Şifre" },
  { href: "#mfa", label: "OTP / MFA" },
  { href: "#sessions", label: "Aktif oturumlar" }
] as const;

export function AccountSecurityPageContent({
  apiBaseUrl
}: AccountSecurityPageContentProps) {
  return (
    <PageContainer
      ariaLabel="Hesap güvenliği"
      className="account-security-page grid gap-6 pb-16 pt-6 sm:pt-8"
    >
      <header className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-background/90 p-5 shadow-[0_18px_60px_rgba(55,48,42,0.09)] sm:p-7">
        <p className="eyebrow">Hesap güvenliği</p>
        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          Güvenlik merkezi
        </h1>
        <p className="max-w-3xl text-sm font-semibold leading-6 text-muted-foreground sm:text-base">
          Şifreni, ikinci doğrulama adımını ve açık cihaz oturumlarını tek yerden yönet.
          Güvenlik işlemlerinde mevcut şifren yeniden doğrulanır; token ve oturum
          kimlikleri kullanıcıya açık alanlarda gösterilmez.
        </p>

        <nav
          aria-label="Güvenlik bölümleri"
          className="flex flex-wrap gap-2 pt-1"
        >
          {securitySections.map((section) => (
            <a
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-black text-foreground transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              href={section.href}
              key={section.href}
            >
              {section.label}
            </a>
          ))}
        </nav>
      </header>

      <div className="grid gap-6">
        <section
          aria-label="Şifre güvenliği"
          className="scroll-mt-28"
          id="password"
        >
          <ChangePasswordForm apiBaseUrl={apiBaseUrl} />
        </section>

        <section
          aria-label="OTP ve MFA ayarları"
          className="scroll-mt-28"
          id="mfa"
        >
          <MfaSettingsPanel apiBaseUrl={apiBaseUrl} />
        </section>

        <section
          aria-label="Aktif oturum yönetimi"
          className="scroll-mt-28"
          id="sessions"
        >
          <SessionManagementPanel apiBaseUrl={apiBaseUrl} />
        </section>
      </div>
    </PageContainer>
  );
}
