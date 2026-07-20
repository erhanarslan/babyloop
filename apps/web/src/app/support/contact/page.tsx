import type { Metadata } from "next";
import { SiteShell } from "../../../components/ui";
import { getLegalOperatorConfig } from "../../../features/legal/legal-config";
import { buildCanonicalUrl } from "../../../lib/seo";

export const metadata: Metadata = {
  title: "İletişim ve veri başvuruları",
  description: "BabyLoop destek, güvenlik bildirimi ve KVKK başvuru kanalları.",
  alternates: { canonical: buildCanonicalUrl("/support/contact") }
};

export default function ContactPage() {
  const operator = getLegalOperatorConfig();

  return (
    <SiteShell>
      <section className="section page-container legal-contact-page" aria-label="İletişim ve veri başvuruları">
        <p className="eyebrow">Destek ve başvuru</p>
        <h1>BabyLoop ile iletişim</h1>
        <p>
          Hesap, güvenlik, içerik bildirimi veya kişisel veri talebiniz için aşağıdaki kanalı kullanın.
          Şifre, kart bilgisi ya da tek kullanımlık doğrulama kodu göndermeyin.
        </p>
        <div className="legal-contact-card">
          <div><strong>İşletmeci</strong><span>{operator.operatorName}</span></div>
          <div><strong>E-posta</strong><a href={`mailto:${operator.contactEmail}`}>{operator.contactEmail}</a></div>
          <div><strong>Başvuru adresi</strong><span>{operator.address}</span></div>
        </div>
        {!operator.configured ? (
          <div className="alert error-alert" role="alert">
            Production yayını öncesinde gerçek işletmeci kimliği, e-posta ve başvuru adresi yapılandırılmalıdır.
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}
