"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type BackofficeShellProps = {
  children: ReactNode;
  role: string;
};

type NavigationItem =
  {
    description: string;
    href: string;
    label: string;
  };

type NavigationGroup = {
  items: NavigationItem[];
  label: string;
};

const navigationGroups: NavigationGroup[] = [
  {
    label: "Genel Bakış",
    items: [
      {
        label: "Genel Bakış",
        href: "/",
        description: "Operasyon özeti"
      }
    ]
  },
  {
    label: "Pazaryeri",
    items: [
      {
        label: "İlanlar",
        href: "/listings",
        description: "İlan ve görsel inceleme"
      }
    ]
  },
  {
    label: "Moderasyon ve Güvenlik",
    items: [
      {
        label: "Moderasyon Vakaları",
        href: "/moderation",
        description: "Vaka ve yaptırım akışı"
      },
      {
        label: "Mesaj İncelemeleri",
        href: "/conversations",
        description: "Konuşma güvenliği"
      },
      {
        label: "Audit Logları",
        href: "/audit",
        description: "Admin işlem geçmişi"
      }
    ]
  },
  {
    label: "Kullanıcılar",
    items: [
      {
        label: "Profiller",
        href: "/profiles",
        description: "Profil risk dizini"
      }
    ]
  },
  {
    label: "İletişim",
    items: [
      {
        label: "Bildirim Operasyonları",
        href: "/notifications",
        description: "Push, in-app ve readiness"
      },
      {
        label: "Email Operasyonları",
        href: "/email",
        description: "Provider ve test gönderimi"
      }
    ]
  },
  {
    label: "Analitik",
    items: [
      {
        label: "Genel Bakış",
        href: "/analytics",
        description: "Ürün ve etkileşim özeti"
      },
      {
        label: "Kullanıcılar",
        href: "/analytics/users",
        description: "Aktif ve yeni kullanıcılar"
      },
      {
        label: "Auth",
        href: "/analytics/auth",
        description: "Doğrulama ve giriş metrikleri"
      },
      {
        label: "Etkileşim",
        href: "/analytics/engagement",
        description: "Sayfa ve ekran süreleri"
      },
      {
        label: "Pazaryeri",
        href: "/analytics/marketplace",
        description: "İlan ve kategori dönüşümü"
      },
      {
        label: "Mesajlaşma",
        href: "/analytics/messaging",
        description: "Sohbet kullanımı"
      },
      {
        label: "Asistan",
        href: "/analytics/assistant",
        description: "RAG ve aksiyon metrikleri"
      },
      {
        label: "Çocuk Özellikleri",
        href: "/analytics/child",
        description: "Profil ve hatırlatıcı kullanımı"
      },
      {
        label: "Huniler",
        href: "/analytics/funnels",
        description: "Dönüşüm adımları"
      },
      {
        label: "Veri Kalitesi",
        href: "/analytics/data-quality",
        description: "Event ve rollup sağlığı"
      },
      {
        label: "Ürün Olayları",
        href: "/product-analytics",
        description: "Aggregate product event görünümü"
      }
    ]
  },
  {
    label: "AI ve RAG",
    items: [
      {
        label: "AI Operasyonları",
        href: "/ai-ops",
        description: "Provider ve run sağlığı"
      },
      {
        label: "RAG Yönetimi",
        href: "/rag",
        description: "Retrieval ve index görünürlüğü"
      }
    ]
  },
  {
    label: "Sistem",
    items: [
      {
        label: "Storage",
        href: "/storage",
        description: "DB, R2, Qdrant ve cache"
      }
    ]
  }
];

export function BackofficeShell({ children, role }: BackofficeShellProps) {
  const pathname = usePathname();
  const viewer = role.toLowerCase() === "backoffice_viewer";
  const visibleNavigationGroups = viewer
    ? navigationGroups.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.href === "/" || item.href === "/listings" || item.href === "/profiles"),
      })).filter((group) => group.items.length > 0)
    : navigationGroups;

  return (
    <div className="backoffice-shell">
      <aside className="backoffice-sidebar" aria-label="Backoffice navigation">
        <div className="brand-block">
          <p className="brand-eyebrow">BabyLoop</p>
          <h1>Backoffice</h1>
        </div>

        <nav className="sidebar-nav">
          {visibleNavigationGroups.map((group) => (
            <section className="sidebar-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => {
                const isActive = item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                    href={item.href}
                    key={item.href}
                  >
                    <span>{item.label}</span>
                    <small>{item.description}</small>
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>

      <div className="backoffice-main-column">
        <header className="backoffice-topbar">
          <div>
            <p className="topbar-eyebrow">Operasyon Konsolu</p>
            <strong>Pazaryeri, güvenlik, analitik, AI ve sistem operasyonları</strong>
          </div>

          {viewer ? <div className="topbar-status">Salt okunur</div> : null}

        </header>

        <main className="backoffice-content">{children}</main>
      </div>
    </div>
  );
}
