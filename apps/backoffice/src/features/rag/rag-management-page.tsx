"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useState } from "react";

import {
  clearAdminRagCache,
  getAdminRagCacheStats,
  getAdminRagHealth,
  listAdminRagDocuments,
  listAdminRagEvalCases,
  runAdminRagEval,
  type RagCacheStats,
  type RagDocumentSummary,
  type RagEvalCase,
  type RagEvalRunSummary,
  type RagHealth,
} from "./api";

type LoadState = {
  health: RagHealth | null;
  documents: RagDocumentSummary[];
  cache: RagCacheStats | null;
  cases: RagEvalCase[];
};

export function RagManagementPage() {
  const [state, setState] = useState<LoadState>({
    health: null,
    documents: [],
    cache: null,
    cases: [],
  });
  const [evalSummary, setEvalSummary] = useState<RagEvalRunSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadRag() {
      setIsLoading(true);
      setErrorMessage(null);

      const [healthResponse, documentsResponse, cacheResponse, casesResponse] = await Promise.all([
        getAdminRagHealth(),
        listAdminRagDocuments(),
        getAdminRagCacheStats(),
        listAdminRagEvalCases(),
      ]);

      if (!isActive) {
        return;
      }

      const error =
        getError(healthResponse) ??
        getError(documentsResponse) ??
        getError(cacheResponse) ??
        getError(casesResponse);

      if (error) {
        setErrorMessage(error);
      }

      setState({
        health: healthResponse.ok ? healthResponse.data.health : null,
        documents: documentsResponse.ok ? documentsResponse.data.documents : [],
        cache: cacheResponse.ok ? cacheResponse.data.cache : null,
        cases: casesResponse.ok ? casesResponse.data.cases : [],
      });
      setIsLoading(false);
    }

    void loadRag();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleEval(mode: "mock" | "live") {
    setIsRunningEval(true);
    setErrorMessage(null);

    const response = await runAdminRagEval(mode, 20);

    if (response.ok) {
      setEvalSummary(response.data);
    } else {
      setErrorMessage(response.error.message);
    }

    setIsRunningEval(false);
  }

  async function handleClearCache() {
    const response = await clearAdminRagCache();

    if (response.ok) {
      setState((current) => ({
        ...current,
        cache: response.data.cache,
      }));
      return;
    }

    setErrorMessage(response.error.message);
  }

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">RAG</p>
          <h2>RAG Yönetimi</h2>
          <p>Bilgi tabanı, Qdrant durumu, cache ve eval sonuçlarını buradan izleyebilirsin.</p>
        </div>
      </div>

      {isLoading ? <div className="state-panel">RAG bilgileri yükleniyor...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {state.health ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="RAG durumu">
            <SummaryCard label="RAG" value={state.health.enabled ? "Açık" : "Kapalı"} />
            <SummaryCard label="Qdrant" value={state.health.qdrant.status} />
            <SummaryCard label="Collection" value={state.health.collection ?? "-"} />
            <SummaryCard label="Points" value={state.health.qdrant.pointsCount} />
            <SummaryCard label="Vector size" value={state.health.qdrant.vectorSize} />
            <SummaryCard label="Doküman" value={state.health.docs.documentCount} />
            <SummaryCard label="Chunk" value={state.health.docs.chunkCountEstimate} />
            <SummaryCard label="Cache" value={state.health.config.cacheEnabled ? "Açık" : "Kapalı"} />
          </section>

          <section className="module-grid" aria-label="RAG konfigürasyonu">
            <article className="module-card dashboard-module-card">
              <h3>Konfigürasyon</h3>
              <dl className="compact-details">
                <DetailRow label="Embedding" value={`${state.health.config.embeddingProvider} · ${state.health.config.embeddingModel}`} />
                <DetailRow label="Chat" value={`${state.health.config.chatProvider} · ${state.health.config.chatModel}`} />
                <DetailRow label="Min score" value={state.health.config.minScore} />
                <DetailRow label="Max chunks" value={state.health.config.maxChunks} />
                <DetailRow label="Max source/doc" value={state.health.config.maxSourcesPerDocument} />
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Cache</h3>
              <dl className="compact-details">
                <DetailRow label="Entries" value={state.cache?.entries ?? 0} />
                <DetailRow label="Hits" value={state.cache?.hits ?? 0} />
                <DetailRow label="Misses" value={state.cache?.misses ?? 0} />
                <DetailRow label="Hit rate" value={`${Math.round((state.cache?.hitRate ?? 0) * 100)}%`} />
              </dl>
              <button className="secondary-action" onClick={handleClearCache} type="button">
                Cache temizle
              </button>
            </article>
          </section>
        </>
      ) : null}

      <section className="module-card dashboard-module-card">
        <div className="page-toolbar">
          <div>
            <h3>Dokümanlar</h3>
            <p>RAG markdown kaynaklarının metadata ve chunk durumları.</p>
          </div>
        </div>
        <div className="table-list">
          {state.documents.map((document) => (
            <div className="table-list-row" key={document.id}>
              <div>
                <strong>{document.title}</strong>
                <p className="muted">{document.sourcePath}</p>
              </div>
              <small className="muted">
                {document.topic} · {document.sourceReliability} · v{document.version} · {document.chunkCountEstimate} chunk · {document.hasRequiredMetadata ? "metadata tamam" : "metadata eksik"}
              </small>
            </div>
          ))}
        </div>
      </section>

      <section className="module-card dashboard-module-card">
        <div className="page-toolbar">
          <div>
            <h3>Eval</h3>
            <p>Mock eval dış servis çağırmaz. Live eval gerçek Gemini/Qdrant çağrısı yapar, kota kullanabilir.</p>
          </div>
          <div className="toolbar-actions">
            <button
              className="primary-action"
              disabled={isRunningEval}
              onClick={() => void handleEval("mock")}
              type="button"
            >
              Mock eval çalıştır
            </button>
            <button
              className="secondary-action"
              disabled={isRunningEval || !state.health?.config.liveEvalEnabled}
              onClick={() => void handleEval("live")}
              type="button"
            >
              Live eval çalıştır
            </button>
          </div>
        </div>

        <p className="muted">{state.cases.length} eval case tanımlı.</p>

        {evalSummary ? (
          <>
            <section className="summary-grid dashboard-summary-grid" aria-label="Eval sonucu">
              <SummaryCard label="Mod" value={evalSummary.mode} />
              <SummaryCard label="Toplam" value={evalSummary.total} />
              <SummaryCard label="Geçen" value={evalSummary.passed} />
              <SummaryCard label="Kalan" value={evalSummary.failed} />
              <SummaryCard label="Süre" value={`${evalSummary.durationMs} ms`} />
            </section>
            <div className="table-list">
              {evalSummary.results.map((result) => (
                <div className="table-list-row" key={result.id}>
                  <div>
                    <strong>{result.id}</strong>
                    <p className="muted">{result.expectedMode} → {result.actualMode}</p>
                  </div>
                  <small className={result.passed ? "muted" : "danger"}>
                    {result.passed ? "Geçti" : result.issues.join(", ")}
                  </small>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getError<T>(response: ApiResponse<T>): string | null {
  return response.ok ? null : response.error.message;
}
