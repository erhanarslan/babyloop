import { BackofficeAuthShell } from "../features/auth/backoffice-auth-shell";
import { getApiBaseUrl } from "../lib/api";

const dashboardCards = [
  {
    title: "Moderation Queue",
    description: "Review reported listings, messages, and profiles.",
    status: "Next migration target",
  },
  {
    title: "Data Privacy",
    description: "Backoffice responses must be redacted server-side.",
    status: "BO-0 priority",
  },
  {
    title: "AI Assistant",
    description: "Human-in-the-loop AI review tools for moderation cases.",
    status: "Planned",
  },
  {
    title: "Audit Logs",
    description: "Immutable history for admin and sensitive data access.",
    status: "Planned",
  },
];

export default function BackofficeHomePage() {
  const apiBaseUrl = getApiBaseUrl();

  return (
    <BackofficeAuthShell>
      <section className="page-heading">
        <p className="eyebrow">BabyLoop Operations</p>
        <h2>Backoffice foundation</h2>
        <p>
          Dedicated architecture foundation is ready for moderation, trust and
          safety, support, audit, and AI-assisted operations.
        </p>
      </section>

      <section className="info-grid" aria-label="Backoffice environment">
        <article className="info-card">
          <span>Application</span>
          <strong>@babyloop/backoffice</strong>
        </article>

        <article className="info-card">
          <span>Local URL</span>
          <strong>http://localhost:3001</strong>
        </article>

        <article className="info-card">
          <span>API base URL</span>
          <strong>{apiBaseUrl}</strong>
        </article>
      </section>

      <section className="module-grid" aria-label="Backoffice modules">
        {dashboardCards.map((card) => (
          <article className="module-card" key={card.title}>
            <div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
            <span>{card.status}</span>
          </article>
        ))}
      </section>
    </BackofficeAuthShell>
  );
}
