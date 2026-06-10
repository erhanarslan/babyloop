import { getApiBaseUrl } from "../lib/api";

export default function BackofficeHomePage() {
  const apiBaseUrl = getApiBaseUrl();

  return (
    <main className="backoffice-page">
      <section className="backoffice-card">
        <p className="eyebrow">BabyLoop Operations</p>
        <h1>BabyLoop Backoffice</h1>
        <p>
          Dedicated architecture foundation is ready for moderation, trust and
          safety, support, audit, and AI-assisted operations.
        </p>

        <dl className="status-list">
          <div>
            <dt>Application</dt>
            <dd>@babyloop/backoffice</dd>
          </div>
          <div>
            <dt>Local URL</dt>
            <dd>http://localhost:3001</dd>
          </div>
          <div>
            <dt>API base URL</dt>
            <dd>{apiBaseUrl}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
