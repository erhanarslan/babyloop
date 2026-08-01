"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useState, type FormEvent } from "react";
import { LoadingState, RecoverableError } from "../shared/async-state";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

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

type PanelError = { code: string; title: string };
type PanelErrors = Partial<Record<keyof LoadState, PanelError>>;

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
  const [reloadVersion, setReloadVersion] = useState(0);
  const [panelErrors, setPanelErrors] = useState<PanelErrors>({});
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
      setPanelErrors({});

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

      setPanelErrors({
        ...(healthResponse.ok ? {} : { health: getPanelError(healthResponse, "RAG durumu alınamadı") }),
        ...(documentsResponse.ok ? {} : { documents: getPanelError(documentsResponse, "Dokümanlar alınamadı") }),
        ...(cacheResponse.ok ? {} : { cache: getPanelError(cacheResponse, "Önbellek durumu alınamadı") }),
        ...(casesResponse.ok ? {} : { cases: getPanelError(casesResponse, "Değerlendirme vakaları alınamadı") }),
        ...(evalHistoryResponse.ok ? {} : { evalHistory: getPanelError(evalHistoryResponse, "Değerlendirme geçmişi alınamadı") }),
        ...(reindexResponse.ok ? {} : { reindex: getPanelError(reindexResponse, "Dizin durumu alınamadı") }),
        ...(metricsResponse.ok ? {} : { metrics: getPanelError(metricsResponse, "RAG metrikleri alınamadı") }),
        ...(usageResponse.ok ? {} : { usage: getPanelError(usageResponse, "Kullanım limitleri alınamadı") })
      });

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
  }, [reloadVersion]);

  async function handleEval(mode: "mock" | "live") {
    setIsRunningEval(true);
    setErrorMessage(null);

    const response = await runAdminRagEval(mode, 20);

    if (response.ok) {
      setEvalSummary(response.data);
      await refreshEvalHistory();
    } else {
      setErrorMessage(getSafeOperationError(response.error.code));
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

    setErrorMessage(getSafeOperationError(response.error.code));
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
      setErrorMessage(getSafeOperationError(response.error.code));
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
      setErrorMessage(getSafeOperationError(response.error.code));
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
      setErrorMessage(getSafeOperationError(response.error.code));
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
      setErrorMessage(getSafeOperationError(response.error.code));
    }

    setIsRunningReindex(false);
  }

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">RAG</p>
          <h2>RAG Yönetimi</h2>
          <p>Bilgi tabanı, Qdrant durumu, önbellek ve değerlendirme sonuçlarını buradan izleyebilirsin.</p>
        </div>
      </div>

      <nav className="admin-secondary-nav" aria-label="RAG bölümleri">
        <a href="#rag-overview">Genel durum</a>
        <a href="#rag-retrieval">Getirme testi</a>
        <a href="#rag-documents">Dokümanlar</a>
        <a href="#rag-cache-limits">Önbellek ve sınırlar</a>
        <a href="#rag-index">Dizin yönetimi</a>
        <a href="#rag-technical">Teknik yapılandırma</a>
      </nav>

      {isLoading ? <LoadingState title="RAG bilgileri yükleniyor…" /> : null}

      {panelErrors.health ? (
        <RecoverableError
          title={panelErrors.health.title}
          description={`Güvenli hata kodu: ${panelErrors.health.code}`}
          onRetry={() => setReloadVersion((value) => value + 1)}
        />
      ) : null}

      {errorMessage ? <RecoverableError title="İşlem tamamlanamadı" description={errorMessage} /> : null}

      {state.health ? (
        <>
          <section id="rag-overview" className="summary-grid dashboard-summary-grid" aria-label="RAG durumu">
            <SummaryCard label="RAG" value={state.health.enabled ? "Açık" : "Kapalı"} />
            <SummaryCard label="Qdrant" value={state.health.qdrant.status} />
            <SummaryCard label="Koleksiyon" value={state.health.collection ?? "-"} />
            <SummaryCard label="Vektör kaydı" value={state.health.qdrant.pointsCount} />
            <SummaryCard label="Vektör boyutu" value={state.health.qdrant.vectorSize} />
            <SummaryCard label="Doküman" value={state.health.docs.documentCount} />
            <SummaryCard label="Parça" value={state.health.docs.chunkCountEstimate} />
            <SummaryCard label="Üst veri eksik" value={state.health.docs.missingMetadataCount} />
            <SummaryCard label="Güncel değil" value={state.health.docs.staleDocumentCount} />
            <SummaryCard label="Yeniden dizinleme" value={state.health.docs.reindexRequiredCount} />
            <SummaryCard label="Önbellek" value={state.health.config.cacheEnabled ? "Açık" : "Kapalı"} />
            <SummaryCard label="Redis" value={state.health.redis.enabled ? state.health.redis.backendEffective : "Kapalı"} />
          </section>

          <section className="module-grid" aria-label="RAG konfigürasyonu">
            <article id="rag-technical" className="module-card dashboard-module-card">
              <h3>Yapılandırma</h3>
              <dl className="compact-details">
                <DetailRow label="Vektörleştirme" value={`${state.health.config.embeddingProvider} · ${state.health.config.embeddingModel}`} />
                <DetailRow label="Sohbet" value={`${state.health.config.chatProvider} · ${state.health.config.chatModel}`} />
                <DetailRow label="En düşük skor" value={state.health.config.minScore} />
                <DetailRow label="En çok parça" value={state.health.config.maxChunks} />
                <DetailRow label="Doküman başına en çok kaynak" value={state.health.config.maxSourcesPerDocument} />
                <DetailRow label="Önbellek arka ucu" value={`${formatEnumLabel(state.health.config.cacheBackend)} → ${formatEnumLabel(state.health.config.cacheBackendEffective)}`} />
                <DetailRow label="Kullanım arka ucu" value={`${formatEnumLabel(state.health.config.usageBackend)} → ${formatEnumLabel(state.health.config.usageBackendEffective)}`} />
                <DetailRow label="Metrik arka ucu" value={`${formatEnumLabel(state.health.config.metricsBackend)} → ${formatEnumLabel(state.health.config.metricsBackendEffective)}`} />
              </dl>
            </article>

            <article id="rag-cache-limits" className="module-card dashboard-module-card">
              <h3>Önbellek</h3>
              {panelErrors.cache ? <PanelErrorState error={panelErrors.cache} /> : null}
              <dl className="compact-details">
                <DetailRow label="Kayıt" value={state.cache?.entries ?? 0} />
                <DetailRow label="İsabet" value={state.cache?.hits ?? 0} />
                <DetailRow label="Kaçan" value={state.cache?.misses ?? 0} />
                <DetailRow label="Yazım" value={state.cache?.sets ?? 0} />
                <DetailRow label="Temizlik" value={state.cache?.clears ?? 0} />
                <DetailRow label="İsabet oranı" value={`${Math.round((state.cache?.hitRate ?? 0) * 100)}%`} />
                <DetailRow label="Arka uç" value={`${formatEnumLabel(state.cache?.backend ?? "disabled")} → ${formatEnumLabel(state.cache?.backendEffective ?? "disabled")}`} />
              </dl>
              <button className="secondary-action" onClick={handleClearCache} type="button">
                Önbelleği temizle
              </button>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Kullanım sınırı</h3>
              <dl className="compact-details">
                <DetailRow label="Durum" value={state.usage?.enabled ? "Açık" : "Kapalı"} />
                <DetailRow label="Arka uç" value={`${formatEnumLabel(state.usage?.backend ?? "disabled")} → ${formatEnumLabel(state.usage?.backendEffective ?? "disabled")}`} />
                <DetailRow label="Misafir saatlik" value={state.usage?.limits.hourlyGuest ?? 0} />
                <DetailRow label="Misafir günlük" value={state.usage?.limits.dailyGuest ?? 0} />
                <DetailRow label="Kullanıcı saatlik" value={state.usage?.limits.hourlyUser ?? 0} />
                <DetailRow label="Kullanıcı günlük" value={state.usage?.limits.dailyUser ?? 0} />
                <DetailRow label="Yönetici muafiyeti" value={state.usage?.limits.adminBypass ? "Açık" : "Kapalı"} />
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Metrikler</h3>
              <dl className="compact-details">
                <DetailRow label="Tarih" value={state.metrics?.date ?? "-"} />
                <DetailRow label="Arka uç" value={`${formatEnumLabel(state.metrics?.backend ?? "disabled")} → ${formatEnumLabel(state.metrics?.backendEffective ?? "disabled")}`} />
                <DetailRow label="Toplam istek" value={metric(state.metrics, "totalRequests")} />
                <DetailRow label="Asistan" value={metric(state.metrics, "assistantRequests")} />
                <DetailRow label="Arama" value={metric(state.metrics, "searchRequests")} />
                <DetailRow label="RAG cevap" value={metric(state.metrics, "ragResponses")} />
                <DetailRow label="Sınır cevabı" value={metric(state.metrics, "boundaryResponses")} />
                <DetailRow label="Kaynak yok" value={metric(state.metrics, "noSourceResponses")} />
                <DetailRow label="Önbellek isabet/kaçırma" value={`${metric(state.metrics, "cacheHits")} / ${metric(state.metrics, "cacheMisses")}`} />
                <DetailRow label="Sınırlandırılan" value={metric(state.metrics, "rateLimitedRequests")} />
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Doküman kalitesi</h3>
              <dl className="compact-details">
                <DetailRow label="Toplam" value={state.reindex?.totalDocuments ?? state.health.docs.documentCount} />
                <DetailRow label="Yeniden dizinleme gerekli" value={state.reindex?.reindexRequired ?? state.health.docs.reindexRequiredCount} />
                <DetailRow label="Güncel değil" value={state.reindex?.stale ?? state.health.docs.staleDocumentCount} />
                <DetailRow label="Eksik" value={state.reindex?.missing ?? countStatus(state.health.docs.indexingStatusCounts, "missing")} />
                <DetailRow label="Bilinmiyor" value={state.reindex?.unknown ?? countStatus(state.health.docs.indexingStatusCounts, "unknown")} />
                <DetailRow label="Üst veri eksik" value={state.health.docs.missingMetadataCount} />
              </dl>
            </article>
          </section>
        </>
      ) : null}

      <section id="rag-retrieval" className="module-card dashboard-module-card">
        <div className="page-toolbar">
          <div>
            <h3>RAG Deneme Alanı</h3>
            <p>Bir test sorusu yazıp getirme sonuçlarını, kaynakları ve isteğe bağlı cevap önizlemesini görebilirsin.</p>
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
              <span>En çok sonuç</span>
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
            {isRunningPlayground ? "Çalışıyor…" : "Denemeyi çalıştır"}
          </button>
        </form>

        {playgroundResult ? (
          <div className="state-panel">
            <h4>Sorgu analizi</h4>
            <dl className="compact-details">
              <DetailRow label="Normalleştirilmiş" value={playgroundResult.query.normalized || "-"} />
              <DetailRow label="Getirme sorgusu" value={playgroundResult.query.retrievalQuery || "-"} />
              <DetailRow label="Sözcük parçaları" value={joinList(playgroundResult.query.tokens)} />
              <DetailRow label="Ürün sinyali" value={joinList(playgroundResult.query.productTerms)} />
              <DetailRow label="Yaş sinyali" value={joinList(playgroundResult.query.ageSignals)} />
              <DetailRow label="Konum sinyali" value={joinList(playgroundResult.query.locationSignals)} />
              <DetailRow label="Konu ipuçları" value={joinList(playgroundResult.query.topicHints)} />
            </dl>
            {playgroundResult.diagnostics.warnings.length > 0 ? (
              <div className="state-panel warning">
                {playgroundResult.diagnostics.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
            <h4>Getirme sonuçları</h4>
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
                  {formatEnumLabel(playgroundResult.answerPreview.mode)} · kaynaklı {playgroundResult.answerPreview.grounded ? "evet" : "hayır"} · araçlar {joinList(playgroundResult.answerPreview.toolsUsed ?? [])}
                </p>
                {playgroundResult.answerPreview.intent ? (
                  <p className="muted">Niyet: {formatEnumLabel(playgroundResult.answerPreview.intent)}</p>
                ) : null}
                {playgroundResult.answerPreview.toolResultsPreview?.length ? (
                  <div className="table-list">
                    {playgroundResult.answerPreview.toolResultsPreview.map((item) => (
                      <div className="table-list-row" key={`${item.tool}-${item.title}`}>
                        <div>
                          <strong>{item.title}</strong>
                          <p className="muted">{item.tool} · {item.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {playgroundResult.answerPreview.suggestedActions?.length ? (
                  <ul>
                    {playgroundResult.answerPreview.suggestedActions.map((action) => (
                      <li key={`${action.type}-${action.label}`}>
                        {action.label}{action.href ? ` · ${action.href}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
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

      <section id="rag-index" className="module-card dashboard-module-card">
        <div className="page-toolbar">
          <div>
            <h3>Yeniden dizinleme akışı</h3>
            <p>Dizin durumunu kontrol et ve güvenli manuel komutu hazırla.</p>
          </div>
          <div className="toolbar-actions">
            <button className="secondary-action" disabled={isRunningReindex} onClick={() => void handleReindex("check")} type="button">
              Dizin durumunu kontrol et
            </button>
          </div>
        </div>
        {panelErrors.reindex ? <PanelErrorState error={panelErrors.reindex} /> : null}
        <section className="summary-grid dashboard-summary-grid" aria-label="Dizin özeti">
          <SummaryCard label="Yeniden dizinleme gerekli" value={state.reindex?.reindexRequired ?? 0} />
          <SummaryCard label="Güncel değil" value={state.reindex?.stale ?? 0} />
          <SummaryCard label="Eksik" value={state.reindex?.missing ?? 0} />
          <SummaryCard label="Bilinmiyor" value={state.reindex?.unknown ?? 0} />
        </section>
        <div className="table-list">
          {(state.reindex?.documents ?? []).slice(0, 8).map((document) => (
            <div className="table-list-row" key={document.id}>
              <div>
                <strong>{document.title}</strong>
                <p className="muted">{formatEnumLabel(document.indexingStatus)} · {document.sourcePath} · sağlama özeti {document.checksumShort}</p>
              </div>
            </div>
          ))}
          {(state.reindex?.documents ?? []).length === 0 ? <div className="state-panel">Yeniden dizinleme gereken doküman görünmüyor.</div> : null}
        </div>
        <div className="state-panel warning">
          <p>Yeniden dizinleme Qdrant içeriğini güncelleyebilir. Üretimde ayrı bir iş kuyruğuyla yapılmalıdır.</p>
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
            Tam yeniden dizinleme akışını hazırla
          </button>
          {reindexResult?.manualCommand ? (
            <p>
              Güvenli yeniden dizinleme için terminalde çalıştır: <code>{reindexResult.manualCommand}</code>
            </p>
          ) : null}
          {reindexResult?.warning ? <p className="muted">{reindexResult.warning}</p> : null}
        </div>
      </section>

      <section id="rag-documents" className="module-card dashboard-module-card">
        <div className="page-toolbar">
          <div>
            <h3>Dokümanlar</h3>
            <p>RAG Markdown kaynaklarının üst veri ve parça durumları.</p>
          </div>
        </div>
        {panelErrors.documents ? <PanelErrorState error={panelErrors.documents} /> : null}
        <div className="table-list">
          {state.documents.map((document) => (
            <article className="table-list-row" key={document.id}>
              <div>
                <strong>{document.title}</strong>
                <p className="muted">{document.sourcePath}</p>
                <p className="muted">
                  {document.topic} · {document.sourceReliability} · v{document.version} · {document.chunkCountEstimate} parça · sağlama özeti {document.checksumShort}
                </p>
                <p className={document.reindexRequired ? "danger" : "muted"}>
                  {statusLabel(document.indexingStatus)} · {document.reindexRequired ? "yeniden dizinleme gerekli" : "dizin güncel"} · {document.hasRequiredMetadata ? "üst veri tamam" : `üst veri eksik: ${document.missingMetadataFields.join(", ")}`}
                </p>
              </div>
              <div className="toolbar-actions">
                <small className="muted">{document.lastIndexedAt ? `Son dizinleme: ${formatDateTimeTr(document.lastIndexedAt)}` : "Son dizinleme yok"}</small>
                <button
                  className="secondary-action"
                  disabled={loadingChunkDocumentId === document.id}
                  onClick={() => void handlePreviewChunks(document.id)}
                  type="button"
                >
                  {chunkPreview?.document.id === document.id ? "Önizlemeyi kapat" : "Parçaları önizle"}
                </button>
              </div>
              {chunkPreview?.document.id === document.id ? (
                <div className="state-panel">
                  <strong>{chunkPreview.document.title} · parça önizlemesi</strong>
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
            <h3>Değerlendirme geçmişi</h3>
            <p>Son değerlendirme kayıtları ve başarısız vaka ayrıntıları.</p>
          </div>
        </div>
        <div className="table-list">
          {state.evalHistory.map((run) => (
            <article className="table-list-row" key={run.runId}>
              <div>
                <strong>{run.runId.slice(0, 8)} · {formatEnumLabel(run.mode)}</strong>
                <p className="muted">{formatDateTimeTr(run.startedAt)} · {runStatusLabel(run.status)} · {run.passed}/{run.total} geçti · {run.failed} başarısız</p>
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
                  <strong>Başarısız vakalar</strong>
                  <div className="table-list">
                    {evalHistoryDetail.results.filter((result) => !result.passed).map((result) => (
                      <div className="table-list-row" key={result.id}>
                        <div>
                          <strong>{result.id}</strong>
                          <p className="muted">{result.expectedMode} → {result.actualMode} · skor {formatScore(result.score)}</p>
                          <p>{result.query}</p>
                          <p className="danger">{result.issues.join(", ") || "Sorun yok"}</p>
                          <p className="muted">{result.sources.map((source) => source.topic ?? source.title).join(", ") || "Kaynak yok"}</p>
                        </div>
                      </div>
                    ))}
                    {evalHistoryDetail.results.every((result) => result.passed) ? <div className="state-panel">Başarısız vaka yok.</div> : null}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
          {state.evalHistory.length === 0 ? <div className="state-panel">Henüz değerlendirme geçmişi yok.</div> : null}
        </div>
      </section>

      <section className="module-card dashboard-module-card">
        <div className="page-toolbar">
          <div>
            <h3>Değerlendirme</h3>
            <p>Taklit değerlendirme dış servis çağırmaz. Canlı değerlendirme Gemini/Qdrant çağrısı yapar ve kota kullanabilir.</p>
          </div>
          <div className="toolbar-actions">
            <button
              className="primary-action"
              disabled={isRunningEval}
              onClick={() => void handleEval("mock")}
              type="button"
            >
              Taklit değerlendirmeyi çalıştır
            </button>
            <button
              className="secondary-action"
              disabled={isRunningEval || !state.health?.config.liveEvalEnabled}
              onClick={() => void handleEval("live")}
              type="button"
            >
              Canlı değerlendirmeyi çalıştır
            </button>
          </div>
        </div>

        <p className="muted">{state.cases.length} değerlendirme vakası tanımlı.</p>

        {evalSummary ? (
          <>
            <section className="summary-grid dashboard-summary-grid" aria-label="Değerlendirme sonucu">
              <SummaryCard label="Mod" value={formatEnumLabel(evalSummary.mode)} />
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
    indexed: "Dizin güncel",
    stale: "Güncel değil",
    missing: "Eksik",
    unknown: "Bilinmiyor"
  };

  return labels[status];
}

function runStatusLabel(status: RagEvalHistoryListItem["status"]): string {
  return status === "completed" ? "Tamamlandı" : "Başarısız";
}

function getPanelError<T>(response: ApiResponse<T>, title: string): PanelError {
  return response.ok ? { code: "UNKNOWN", title } : { code: response.error.code, title };
}

function getSafeOperationError(code: string): string {
  const messages: Record<string, string> = {
    FORBIDDEN: "Bu RAG işlemi için yetkin yok.",
    INVALID_REQUEST: "RAG işlemi isteği geçersiz. Alanları kontrol et.",
    RAG_DISABLED: "RAG bu ortamda kullanıma açık değil.",
    RAG_LIVE_EVAL_DISABLED: "Canlı değerlendirme bu ortamda kullanıma açık değil.",
    RAG_REINDEX_CONFIRMATION_REQUIRED: "Tam yeniden dizinleme için güvenlik onayı gerekli."
  };

  return messages[code] ?? "RAG işlemi güvenli biçimde tamamlanamadı. Tekrar dene.";
}

function PanelErrorState({ error }: { error: PanelError }) {
  return <RecoverableError title={error.title} description={`Güvenli hata kodu: ${error.code}`} />;
}
