# BabyLoop RAG operasyon runbook

Bu runbook RAG bilgi tabanı, Qdrant, ingestion, eval ve cache operasyonları için kısa referanstır.

## Qdrant başlatma

Tek başına local Qdrant:

```bash
docker run -p 6333:6333 -v "$(pwd)/.data/qdrant:/qdrant/storage" qdrant/qdrant
```

Collection kontrolü:

```bash
curl -s http://localhost:6333/collections/babyloop_rag | python3 -m json.tool
```

Beklenen vector size Gemini `gemini-embedding-001` için `3072` olmalıdır.

## Ingestion

```bash
set -a
source .env.local
set +a
PATH=/Users/erhan-pc-mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @babyloop/api rag:ingest
```

Script `docs/rag` markdown dosyalarını chunk’lar, Gemini embedding üretir ve Qdrant’a deterministic point id ile upsert eder.

## Eval

Mock eval dış servis çağırmaz:

```bash
curl -s -X POST http://127.0.0.1:4000/api/v1/admin/rag/eval/run \
  -H "Content-Type: application/json" \
  -d '{"mode":"mock","limit":20}' | python3 -m json.tool
```

Live eval gerçek Gemini/Qdrant çağırır ve kota kullanabilir. `RAG_LIVE_EVAL_ENABLED=true` olmadan çalışmaz.

## Cache temizleme

```bash
curl -s -X POST http://127.0.0.1:4000/api/v1/admin/rag/cache/clear | python3 -m json.tool
```

Backoffice `/rag` ekranındaki “Cache temizle” butonu aynı endpointi kullanır.

## Sık hatalar

### Vector size mismatch

Hata: embedding boyutu Qdrant collection boyutuyla eşleşmiyor.

Çözüm: `RAG_QDRANT_VECTOR_SIZE=3072` kullan ve model değiştiyse collection’ı yeniden oluştur.

### RAG_ENABLED false

RAG search ve assistant RAG mode devre dışıdır. `.env.local` içinde `RAG_ENABLED=true` olmalı.

### Qdrant connection refused

Qdrant çalışmıyor ya da `RAG_QDRANT_URL` yanlış. Local için `http://localhost:6333` beklenir.

### Gemini quota/rate limit

Live eval veya assistant cevap üretimi Gemini kotasına takılabilir. Mock eval dış servis çağırmaz.

### No sources found

Sorgu bilgi tabanı kapsamı dışında olabilir ya da `RAG_MIN_SCORE` yüksek kalmış olabilir. Kaynak yoksa asistan cevap uydurmaz.

## Güvenlik notları

- API key, raw prompt, system prompt ve embedding vector loglanmaz.
- Backoffice RAG paneli secret göstermez.
- Listing search tool seller email, phone veya ham user/profile bilgisi döndürmez.
- Write tool yoktur.
