import Link from "next/link";
import { LEGAL_DOCUMENTS, type LegalDocumentSlug } from "./legal-documents";
import { getLegalOperatorConfig } from "./legal-config";
import styles from "./legal.module.css";

export function LegalDocumentPage({ slug }: { slug: LegalDocumentSlug }) {
  const document = LEGAL_DOCUMENTS[slug];
  const operator = getLegalOperatorConfig();

  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{document.eyebrow}</p>
        <h1>{document.title}</h1>
        <p>{document.description}</p>
        <div className={styles.meta}>
          <span>Sürüm {document.version}</span>
          <span>Son güncelleme 20 Temmuz 2026</span>
        </div>
      </header>

      <aside className={operator.configured ? styles.operator : styles.operatorWarning}>
        <div>
          <strong>Veri sorumlusu / platform işletmecisi</strong>
          <span>{operator.operatorName}</span>
        </div>
        <div>
          <strong>İletişim</strong>
          <a href={`mailto:${operator.contactEmail}`}>{operator.contactEmail}</a>
        </div>
        <div>
          <strong>Başvuru adresi</strong>
          <span>{operator.address}</span>
        </div>
        {!operator.configured ? (
          <p>
            Bu alan local geliştirme placeholder&apos;ıdır. Production yayını, gerçek işletmeci bilgileri
            yapılandırılmadan release gate&apos;ini geçmemelidir.
          </p>
        ) : null}
      </aside>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="Yasal belgeler">
          <h2>Yasal merkez</h2>
          {Object.values(LEGAL_DOCUMENTS).map((item) => (
            <Link aria-current={item.slug === slug ? "page" : undefined} href={`/legal/${item.slug}`} key={item.slug}>
              {item.title}
            </Link>
          ))}
          <Link href="/support/contact">İletişim ve başvuru</Link>
        </nav>

        <div className={styles.content}>
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              ) : null}
            </section>
          ))}

          <div className={styles.reviewNote}>
            <strong>Yayın notu</strong>
            <p>
              Bu ürün metinleri teknik ürün davranışıyla eşleştirilmiştir; şirketleşme, gerçek ödeme,
              yurt dışı aktarım veya sağlayıcı değişikliği öncesinde Türkiye&apos;de yetkili bir hukuk uzmanı
              tarafından nihai inceleme yapılmalıdır.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
