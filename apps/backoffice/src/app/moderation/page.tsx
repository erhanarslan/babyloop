import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";

export default function BackofficeModerationPage() {
  return (
    <BackofficeAuthShell>
      <section className="content-card">
        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Moderation</p>
            <h2>Moderation cases</h2>
            <p>
              Moderation case list will be migrated here from the previous web
              admin proof of concept.
            </p>
          </div>
        </div>

        <div className="state-panel">
          <strong>Backoffice moderation route is ready.</strong>
          <p>
            Next step: connect this page to the admin moderation API and render
            the real case queue.
          </p>
        </div>
      </section>
    </BackofficeAuthShell>
  );
}
