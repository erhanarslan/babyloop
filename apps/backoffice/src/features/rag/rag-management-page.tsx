"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useState, type FormEvent } from "react";

import {
  clearAdminRagCache,
  getAdminRagCacheStats,
  getAdminRagDocumentChunks,
  getAdminRagEvalHistory,
  getAdminRagEvalHistoryDetail,
  getAdminRagHealth,
  getAdminRagMetrics,
  getAdminRagReindexCheck,
  getAdminRagUsage,
  listAdminRagDocuments,
  listAdminRagEvalCases,
  runAdminRagEval,
  runAdminRagPlaygroundQuery,
  runAdminRagReindex,
  type RagCacheStats,
  type RagDocumentChunks,
  type RagDocumentSummary,
  type RagEvalCase,
  type RagEvalHistoryDetail,
  type RagEvalHistoryListItem,
  type RagEvalRunSummary,
  type RagHealth,
  type RagMetrics,
  type RagPlaygroundResponse,
  type RagReindexCheck,
  type RagReindexRunResult,
  type RagUsage,
} from "./api";

type LoadState = {
  health: RagHealth | null;
  documents: RagDocumentSummary[];
  cache: RagCacheStats | null;
  cases: RagEvalCase[];
  evalHistory: RagEvalHistoryListItem[];
  reindex: RagReindexCheck | null;
  metrics: RagMetrics | null;
  usage: RagUsage | null;
};

export function RagManagementPage() {
  const [state, setState] = useState<LoadState>({
    health: null,
    documents: [],
    cache: null,
    cases: [],
    evalHistory: [],
    reindex: null,
    metrics: null,
    usage: null,
  });
  const [chunkPreview, setChunkPreview] = useState<RagDocumentChunks | null>(null);
  const [evalSummary, setEvalSummary] = useState<RagEvalRunSummary | null>(null);
  const [evalHistoryDetail, setEvalHistoryDetail] = useState<RagEvalHistoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playgroundQuery, setPlaygroundQuery] = useState("Bebek arabası alırken nelere dikkat etmeliyim?");
  const [playgroundMode, setPlaygroundMode] = useState<"search" | "answer">("search");
  const [playgroundLimit, setPlaygroundLimit] = useState(5);
  const [playgroundResult, setPlaygroundResult] = useState<RagPlaygroundResponse | null>(null);
  const [isRunningPlayground, setIsRunningPlayground] = useState(false);
  const [loadingChunkDocumentId, setLoadingChunkDocumentId] = useState<string | null>(null);
  const [loadingEvalRunId, setLoadingEvalRunId] = useState<string | null>(null);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [reindexConfirm, setReindexConfirm] = useState("");
  const [reindexResult, setReindexResult] = useState<RagReindexRunResult | null>(null);
  const [isRunningReindex, setIsRunningReindex] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadRag() {
      setIsLoading(true);
      setErrorMessage(null);

      const [
        healthResponse,
        documentsResponse,
        cacheResponse,
        casesResponse,
        metricsResponse,
        usageResponse,
        reindexResponse,
        evalHistoryResponse
      ] = await Promise.all([
        getAdminRagHealth(),
        listAdminRagDocuments(),
        getAdminRagCacheStats(),
        listAdminRagEvalCases(),
        getAdminRagMetrics(),
        getAdminRagUsage(),
        getAdminRagReindexCheck(),
        getAdminRagEvalHistory(),
      ]);

      if (!isActive) {
        return;
      }

      const error =
        getError(healthResponse) ??
        getError(documentsResponse) ??
        getError(cacheResponse) ??
        getError(casesResponse) ??
        getError(metricsResponse) ??
        getError(usageResponse) ??
        getError(reindexResponse) ??
        getError(evalHistoryResponse);

      if (error) {
        setErrorMessage(error);
      }

      setState({
        health: healthResponse.ok ? healthResponse.data.health : null,
        documents: documentsResponse.ok ? documentsResponse.data.documents : [],
        cache: cacheResponse.ok ? cacheResponse.data.cache : null,
        cases: casesResponse.ok ? casesResponse.data.cases : [],
        evalHistory: evalHistoryResponse.ok ? evalHistoryResponse.data.runs : [],
        reindex: reindexResponse.ok ? reindexResponse.data : null,
        metrics: metricsResponse.ok ? metricsResponse.data.metrics : null,
        usage: usageResponse.ok ? usageResponse.data.usage : null,
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
      await refreshEvalHistory();
    } else {
      setErrorMessage(response.error.message);
      await refreshEvalHistory();
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

  async function handlePlaygroundSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunningPlayground(true);
    setErrorMessage(null);

    const response = await runAdminRagPlaygroundQuery({
      query: playgroundQuery,
      mode: playgroundMode,
      limit: playgroundLimit,
      debug: true,
    });

    if (response.ok) {
      setPlaygroundResult(response.data);
    } else {
      setErrorMessage(response.error.message);
    }

    setIsRunningPlayground(false);
  }

  async function handlePreviewChunks(documentId: string) {
    if (chunkPreview?.document.id === documentId) {
      setChunkPreview(null);
      return;
    }

    setLoadingChunkDocumentId(documentId);
    setErrorMessage(null);

    const response = await getAdminRagDocumentChunks(documentId);

    if (response.ok) {
      setChunkPreview(response.data);
    } else {
      setErrorMessage(response.error.message);
    }

    setLoadingChunkDocumentId(null);
  }

  async function refreshEvalHistory() {
    const response = await getAdminRagEvalHistory();

    if (response.ok) {
      setState((current) => ({
        ...current,
        evalHistory: response.data.runs,
      }));
    }
  }

  async function handleEvalHistoryDetail(runId: string) {
    if (evalHistoryDetail?.runId === runId) {
      setEvalHistoryDetail(null);
      return;
    }

    setLoadingEvalRunId(runId);
    setErrorMessage(null);

    const response = await getAdminRagEvalHistoryDetail(runId);

    if (response.ok) {
      setEvalHistoryDetail(response.data.run);
    } else {
      setErrorMessage(response.error.message);
    }

    setLoadingEvalRunId(null);
  }

  async function handleReindex(mode: "check" | "full") {
    setIsRunningReindex(true);
    setErrorMessage(null);

    const response = await runAdminRagReindex({
      mode,
      ...(mode === "full" ? { confirm: reindexConfirm } : {}),
    });

    if (response.ok) {
      setReindexResult(response.data);
      setState((current) => ({
        ...current,
        reindex: response.data.check,
      }));
    } else {
      setErrorMessage(response.error.message);
    }

    setIsRunningReindex(false);
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
            <SummaryCard label="Koleksiyon" value={state.health.collection ?? "-"} />
            <SummaryCard label="Point" value={state.health.qdrant.pointsCount} />
            <SummaryCard label="Vektör boyutu" value={state.health.qdrant.vectorSize} />
            <SummaryCard label="Doküman" value={state.health.docs.documentCount} />
            <SummaryCard label="Chunk" value={state.health.docs.chunkCountEstimate} />
            <SummaryCard label="Metadata eksik" value={state.health.docs.missingMetadataCount} />
            <SummaryCard label="Stale" value={state.health.docs.staleDocumentCount} />
            <SummaryCard label="Reindex" value={state.health.docs.reindexRequiredCount} />
            <SummaryCard label="Cache" value={state.health.config.cacheEnabled ? "Açık" : "Kapalı"} />
            <SummaryCard label="Redis" value={state.health.redis.enabled ? state.health.redis.backendEffective : "Kapalı"} />
          </section>

          <section className="module-grid" aria-label="RAG konfigürasyonu">
            <article className="module-card dashboard-module-card">
              <h3>Konfigürasyon</h3>
              <dl className="compact-details">
                <DetailRow label="Embedding" value={`${state.health.config.embeddingProvider} · ${state.health.config.embeddingModel}`} />
                <DetailRow label="Chat" value={`${state.health.config.chatProvider} · ${state.health.config.chatModel}`} />
                <DetailRow label="Min skor" value={state.health.config.minScore} />
                <DetailRow label="Max chunk" value={state.health.config.maxChunks} />
                <DetailRow label="Max kaynak/doküman" value={state.health.config.maxSourcesPerDocument} />
                <DetailRow label="Cache arka uç" value={`${state.health.config.cacheBackend} → ${state.health.config.cacheBackendEffective}`} />
                <DetailRow label="Kullanım arka uç" value={`${state.health.config.usageBackend} → ${state.health.config.usageBackendEffective}`} />
                <DetailRow label="Metrik arka uç" value={`${state.health.config.metricsBackend} → ${state.health.config.metricsBackendEffective}`} />
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Cache</h3>
              <dl className="compact-details">
                <DetailRow label="Kayıt" value={state.cache?.entries ?? 0} />
                <DetailRow label="İsabet" value={state.cache?.hits ?? 0} />
                <DetailRow label="Kaçan" value={state.cache?.misses ?? 0} />
                <DetailRow label="Yazım" value={state.cache?.sets ?? 0} />
                <DetailRow label="Temizlik" value={state.cache?.clears ?? 0} />
                <DetailRow label="Hit oranı" value={`${Math.round((state.cache?.hitRate ?? 0) * 100)}%`} />
                <DetailRow label="Arka uç" value={`${state.cache?.backend ?? "disabled"} → ${state.cache?.backendEffective ?? "disabled"}`} />
              </dl>
              <button className="secondary-action" onClick={handleClearCache} type="button">
                Cache temizle
              </button>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Kullanım limiti</h3>
              <dl className="compact-details">
                <DetailRow label="Durum" value={state.usage?.enabled ? "Açık" : "Kapalı"} />
                <DetailRow label="Arka uç" value={`${state.usage?.backend ?? "disabled"} → ${state.usage?.backendEffective ?? "disabled"}`} />
                <DetailRow label="Guest saatlik" value={state.usage?.limits.hourlyGuest ?? 0} />
                <DetailRow label="Guest günlük" value={state.usage?.limits.dailyGuest ?? 0} />
                <DetailRow label="User saatlik" value={state.usage?.limits.hourlyUser ?? 0} />
                <DetailRow label="User günlük" value={state.usage?.limits.dailyUser ?? 0} />
                <DetailRow label="Admin muafiyeti" value={state.usage?.limits.adminBypass ? "Açık" : "Kapalı"} />
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Metrics</h3>
              <dl className="compact-details">
                <DetailRow label="Tarih" value={state.metrics?.date ?? "-"} />
                <DetailRow label="Arka uç" value={`${state.metrics?.backend ?? "disabled"} → ${state.metrics?.backendEffective ?? "disabled"}`} />
                <DetailRow label="Toplam istek" value={metric(state.metrics, "totalRequests")} />
                <DetailRow label="Asistan" value={metric(state.metrics, "assistantRequests")} />
                <DetailRow label="Arama" value={metric(state.metrics, "searchRequests")} />
                <DetailRow label="RAG cevap" value={metric(state.metrics, "ragResponses")} />
                <DetailRow label="Sınır cevabı" value={metric(state.metrics, "boundaryResponses")} />
                <DetailRow label="Kaynak yok" value={metric(state.metrics, "noSourceResponses")} />
                <DetailRow label="Cache hit/miss" value={`${metric(state.metrics, "cacheHits")} / ${metric(state.metrics, "cacheMisses")}`} />
                <DetailRow label="Limitlenen" value={metric(state.metrics, "rateLimitedRequests")} />
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Doküman kalite</h3>
              <dl className="compact-details">
                <DetailRow label="Toplam" value={state.reindex?.totalDocuments ?? state.health.docs.documentCount} />
                <DetailRow label="Reindex gerekli" value={state.reindex?.reindexRequired ?? state.health.docs.reindexRequiredCount} />
                <DetailRow label="Stale" value={state.reindex?.stale ?? state.health.docs.staleDocumentCount} />
                <DetailRow label="Eksik" value={state.reindex?.missing ?? countStatus(state.health.docs.indexingStatusCounts, "missing")} />
                <DetailRow label="Bilinmiyor" value={state.reindex?.unknown ?? countStatus(state.health.docs.indexingStatusCounts, "unknown")} />
                <DetailRow label="Metadata eksik" value={state.health.docs.missingMetadataCount} />
              </dl>
            </article>
          </section>
        </>
      ) : null}

      <section className="module-card dashboard-module-card">
        <div className="page-toolbar">
          <div>
            <h3>RAG Playground</h3>
            <p>Bir test sorusu yazıp retrieval sonuçlarını, kaynakları ve isteğe bağlı cevap önizlemesini görebilirsin.</p>
          </div>
        </div>
        <form className="stacked-form" onSubmit={handlePlaygroundSubmit}>
          <label>
            <span>Test sorusu</span>
            <textarea
              onChange={(event) => setPlaygroundQuery(event.target.value)}
              rows={3}
              value={playgroundQuery}
            />
          </label>
          <div className="inline-form-grid">
            <label>
              <span>Mod</span>
              <select
                onChange={(event) => setPlaygroundMode(event.target.value === "answer" ? "answer" : "search")}
                value={playgroundMode}
              >
                <option value="search">Sadece kaynakları getir</option>
                <option value="answer">Cevap önizlemesi üret</option>
              </select>
            </label>
            <label>
              <span>Limit</span>
              <select
                onChange={(event) => setPlaygroundLimit(Number(event.target.value))}
                value={playgroundLimit}
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </label>
          </div>
          <button className="primary-action" disabled={isRunningPlayground || playgroundQuery.trim().length < 2} type="submit">
            {isRunningPlayground ? "Çalışıyor..." : "Playground çalıştır"}
          </button>
        </form>

        {playgroundResult ? (
          <div className="state-panel">
            <h4>Query analizi</h4>
            <dl className="compact-details">
              <DetailRow label="Normalized" value={playgroundResult.query.normalized || "-"} />
              <DetailRow label="Retrieval query" value={playgroundResult.query.retrievalQuery || "-"} />
              <DetailRow label="Tokens" value={joinList(playgroundResult.query.tokens)} />
              <DetailRow label="Ürün sinyali" value={joinList(playgroundResult.query.productTerms)} />
              <DetailRow label="Yaş sinyali" value={joinList(playgroundResult.query.ageSignals)} />
              <DetailRow label="Konum sinyali" value={joinList(playgroundResult.query.locationSignals)} />
              <DetailRow label="Topic hints" value={joinList(playgroundResult.query.topicHints)} />
            </dl>
            {playgroundResult.diagnostics.warnings.length > 0 ? (
              <div className="state-panel warning">
                {playgroundResult.diagnostics.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
            <h4>Retrieval sonuçları</h4>
            <div className="table-list">
              {playgroundResult.results.map((result) => (
                <article className="table-list-row" key={`${result.rank}-${result.sourcePath}-${result.section ?? ""}`}>
                  <div>
                    <strong>#{result.rank} · {result.title}</strong>
                    <p className="muted">{result.section ?? "Genel"} · {result.topic ?? "-"} · {result.sourceReliability ?? "-"}</p>
                    <p className="muted">{result.sourcePath}</p>
                    <p>{result.textPreview}</p>
                    <p className="muted">
                      skor {formatScore(result.score)} · vektör {formatScore(result.vectorScore)} · sözcük {formatScore(result.qualitySignals.lexicalScore)} · konu {result.qualitySignals.topicMatch ? "eşleşti" : "yok"} · kaynak bonusu {formatScore(result.qualitySignals.sourceReliabilityBonus)}
                    </p>
                  </div>
                </article>
              ))}
              {playgroundResult.results.length === 0 ? <div className="state-panel">Kaynak bulunamadı.</div> : null}
            </div>
            {playgroundResult.answerPreview ? (
              <div className="state-panel">
                <h4>Cevap önizlemesi</h4>
                <p>{playgroundResult.answerPreview.answer}</p>
                <p className="muted">
                  {playgroundResult.answerPreview.mode} · kaynaklı {playgroundResult.answerPreview.grounded ? "evet" : "hayır"} · araçlar {joinList(playgroundResult.answerPreview.toolsUsed ?? [])}
                </p>
                {playgroundResult.answerPreview.sources.length > 0 ? (
                  <ul>
                    {playgroundResult.answerPreview.sources.map((source) => (
                      <li key={`${source.sourcePath}-${source.section ?? ""}`}>
                        {source.title} · {source.section ?? "Genel"}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="module-card dashboard-module-card">
        <div className="page-toolbar">
          <div>
            <h3>Reindex workflow</h3>
            <p>Reindex durumunu kontrol et ve güvenli manuel reindex komutunu hazırla.</p>
          </div>
          <div className="toolbar-actions">
            <button className="secondary-action" disabled={isRunningReindex} onClick={() => void handleReindex("check")} type="button">
              Reindex check
            </button>
          </div>
        </div>
        <section className="summary-grid dashboard-summary-grid" aria-label="Reindex özeti">
          <SummaryCard label="Reindex gerekli" value={state.reindex?.reindexRequired ?? 0} />
          <SummaryCard label="Stale" value={state.reindex?.stale ?? 0} />
          <SummaryCard label="Missing" value={state.reindex?.missing ?? 0} />
          <SummaryCard label="Unknown" value={state.reindex?.unknown ?? 0} />
        </section>
        <div className="table-list">
          {(state.reindex?.documents ?? []).slice(0, 8).map((document) => (
            <div className="table-list-row" key={document.id}>
              <div>
                <strong>{document.title}</strong>
                <p className="muted">{document.indexingStatus} · {document.sourcePath} · checksum {document.checksumShort}</p>
              </div>
            </div>
          ))}
          {(state.reindex?.documents ?? []).length === 0 ? <div className="state-panel">Reindex gereken doküman görünmüyor.</div> : null}
        </div>
        <div className="state-panel warning">
          <p>Reindex Qdrant içeriğini güncelleyebilir. Production’da job queue ile yapılmalıdır.</p>
          <label>
            <span>Onay</span>
            <input
              onChange={(event) => setReindexConfirm(event.target.value)}
              placeholder="REINDEX_RAG"
              value={reindexConfirm}
            />
          </label>
          <button
            className="secondary-action"
            disabled={isRunningReindex || reindexConfirm !== "REINDEX_RAG"}
            onClick={() => void handleReindex("full")}
            type="button"
          >
            Full reindex akışını hazırla
          </button>
          {reindexResult?.manualCommand ? (
            <p>
              Güvenli reindex için terminalde çalıştır: <code>{reindexResult.manualCommand}</code>
            </p>
          ) : null}
          {reindexResult?.warning ? <p className="muted">{reindexResult.warning}</p> : null}
        </div>
      </section>

      <section className="module-card dashboard-module-card">
        <div className="page-toolbar">
          <div>
            <h3>Dokümanlar</h3>
            <p>RAG markdown kaynaklarının metadata ve chunk durumları.</p>
          </div>
        </div>
        <div className="table-list">
          {state.documents.map((document) => (
            <article className="table-list-row" key={document.id}>
              <div>
                <strong>{document.title}</strong>
                <p className="muted">{document.sourcePath}</p>
                <p className="muted">
                  {document.topic} · {document.sourceReliability} · v{document.version} · {document.chunkCountEstimate} chunk · checksum {document.checksumShort}
                </p>
                <p className={document.reindexRequired ? "danger" : "muted"}>
                  {statusLabel(document.indexingStatus)} · {document.reindexRequired ? "reindex gerekli" : "index güncel"} · {document.hasRequiredMetadata ? "metadata tamam" : `metadata eksik: ${document.missingMetadataFields.join(", ")}`}
                </p>
              </div>
              <div className="toolbar-actions">
                <small className="muted">{document.lastIndexedAt ? `Son index: ${document.lastIndexedAt}` : "Son index yok"}</small>
                <button
                  className="secondary-action"
                  disabled={loadingChunkDocumentId === document.id}
                  onClick={() => void handlePreviewChunks(document.id)}
                  type="button"
                >
                  {chunkPreview?.document.id === document.id ? "Önizlemeyi kapat" : "Chunk önizle"}
                </button>
              </div>
              {chunkPreview?.document.id === document.id ? (
                <div className="state-panel">
                  <strong>{chunkPreview.document.title} · chunk önizleme</strong>
                  <div className="table-list">
                    {chunkPreview.chunks.map((chunk) => (
                      <div className="table-list-row" key={chunk.chunkId}>
                        <div>
                          <strong>#{chunk.chunkIndex} · {chunk.section}</strong>
                          <p className="muted">{chunk.topic} · {chunk.sourceReliability}</p>
                          <p>{chunk.textPreview}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="module-card dashboard-module-card">
        <div className="page-toolbar">
          <div>
            <h3>Eval history</h3>
            <p>Son eval run kayıtları ve başarısız case detayları.</p>
          </div>
        </div>
        <div className="table-list">
          {state.evalHistory.map((run) => (
            <article className="table-list-row" key={run.runId}>
              <div>
                <strong>{run.runId.slice(0, 8)} · {run.mode}</strong>
                <p className="muted">{run.startedAt} · {runStatusLabel(run.status)} · {run.passed}/{run.total} geçti · {run.failed} başarısız</p>
              </div>
              <button
                className="secondary-action"
                disabled={loadingEvalRunId === run.runId}
                onClick={() => void handleEvalHistoryDetail(run.runId)}
                type="button"
              >
                {evalHistoryDetail?.runId === run.runId ? "Detayı kapat" : "Detay göster"}
              </button>
              {evalHistoryDetail?.runId === run.runId ? (
                <div className="state-panel">
                  <strong>Başarısız case'ler</strong>
                  <div className="table-list">
                    {evalHistoryDetail.results.filter((result) => !result.passed).map((result) => (
                      <div className="table-list-row" key={result.id}>
                        <div>
                          <strong>{result.id}</strong>
                          <p className="muted">{result.expectedMode} → {result.actualMode} · skor {formatScore(result.score)}</p>
                          <p>{result.query}</p>
                          <p className="danger">{result.issues.join(", ") || "Issue yok"}</p>
                          <p className="muted">{result.sources.map((source) => source.topic ?? source.title).join(", ") || "Kaynak yok"}</p>
                        </div>
                      </div>
                    ))}
                    {evalHistoryDetail.results.every((result) => result.passed) ? <div className="state-panel">Başarısız case yok.</div> : null}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
          {state.evalHistory.length === 0 ? <div className="state-panel">Henüz eval history yok.</div> : null}
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

function metric(metrics: RagMetrics | null, key: string): number {
  return metrics?.counters[key] ?? 0;
}

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "-";
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function countStatus(counts: Record<string, number>, key: string): number {
  return counts[key] ?? 0;
}

function statusLabel(status: RagDocumentSummary["indexingStatus"]): string {
  const labels: Record<RagDocumentSummary["indexingStatus"], string> = {
    indexed: "Index güncel",
    stale: "Stale",
    missing: "Eksik",
    unknown: "Bilinmiyor"
  };

  return labels[status];
}

function runStatusLabel(status: RagEvalHistoryListItem["status"]): string {
  return status === "completed" ? "Tamamlandı" : "Başarısız";
}

function getError<T>(response: ApiResponse<T>): string | null {
  return response.ok ? null : response.error.message;
}
