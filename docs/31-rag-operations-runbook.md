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

## Redis başlatma

Local Redis docker compose içinde vardır:

```bash
docker compose -f docker-compose.dev.yml up redis
```

Tek başına:

```bash
docker run -p 6379:6379 redis:7-alpine
```

Redis production backend için örnek env:

```env
RAG_REDIS_ENABLED=true
RAG_REDIS_URL=redis://localhost:6379
RAG_REDIS_KEY_PREFIX=babyloop:rag
RAG_CACHE_BACKEND=redis
RAG_USAGE_LIMITS_BACKEND=redis
RAG_METRICS_BACKEND=redis
```

Redis kapalıysa veya bağlantı zaman aşımına uğrarsa uygulama crash etmez; ilgili servis memory effective backend’e düşer.

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

Cache stats:

```bash
curl -s http://127.0.0.1:4000/api/v1/admin/rag/cache/stats | python3 -m json.tool
```

## Metrics ve usage

Metrics:

```bash
curl -s http://127.0.0.1:4000/api/v1/admin/rag/metrics | python3 -m json.tool
```

Usage limit config:

```bash
curl -s http://127.0.0.1:4000/api/v1/admin/rag/usage | python3 -m json.tool
```

429 görülürse `Retry-After` header’ı kontrol edilebilir. Guest limit raw IP saklamaz; hash’li identifier kullanır.

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

### RAG usage limit

Çok sık `/assistant/messages` veya `/rag/search` çağrısı yapılırsa 429 dönebilir. Local testte limitleri geçici artırmak için:

```env
RAG_HOURLY_GUEST_LIMIT=100
RAG_DAILY_GUEST_LIMIT=500
```

Admin kullanıcılar için `RAG_ADMIN_LIMIT_BYPASS=true` olduğunda limit uygulanmaz.

### Redis fallback

Backoffice RAG health içinde `redis.enabled=true` ama `backendEffective=memory` görünüyorsa Redis erişilemiyor olabilir. `RAG_REDIS_URL`, container durumu ve port erişimi kontrol edilmelidir.

### No sources found

Sorgu bilgi tabanı kapsamı dışında olabilir ya da `RAG_MIN_SCORE` yüksek kalmış olabilir. Kaynak yoksa asistan cevap uydurmaz.

Yeni retrieval kalite katmanı ayrıca final score ve source coverage kontrolü yapar. Ayarlanabilecek env’ler:

```env
RAG_HYBRID_ENABLED=true
RAG_LEXICAL_SCORE_WEIGHT=0.18
RAG_VECTOR_SCORE_WEIGHT=1
RAG_TITLE_MATCH_BONUS=0.04
RAG_SECTION_MATCH_BONUS=0.03
RAG_TOPIC_MATCH_BONUS=0.03
RAG_SOURCE_RELIABILITY_BONUS=0.02
RAG_DUPLICATE_PENALTY=0.05
RAG_NO_SOURCE_MIN_SCORE=0.68
RAG_MIN_SOURCE_COVERAGE=1
```

`RAG_NO_SOURCE_MIN_SCORE` yükselirse asistan daha temkinli olur ama bazı doğru kaynakları kaçırabilir. Düşerse daha fazla kaynak döner ama alakasız cevap riski artar.

### Typo normalization kontrolü

Aşağıdaki sorgular normalizer tarafından canonical ürün sinyallerine çevrilir:

- `bebek arabasi` -> `bebek arabası`
- `oto koltugu` -> `oto koltuğu`
- `ana kucagi` -> `ana kucağı`
- `stroller` veya `puset` -> `bebek arabası`

Bu katman LLM çağırmaz ve ingestion payload metadata’sını değiştirmez.

### Hybrid-lite ile gerçek sparse search farkı

Hybrid-lite mevcut dense Qdrant sonucunu alır ve lexical/topic/sourceReliability sinyalleriyle yeniden sıralar. Qdrant collection schema değişmez.

Gerçek sparse+dense search ise Qdrant collection’da sparse vector veya ayrı lexical index gerektirir. Bu daha güçlüdür ama migration ve ingestion payload değişikliği ister; sonraki faza bırakılmıştır.

## Güvenlik notları

- API key, raw prompt, system prompt ve embedding vector loglanmaz.
- Backoffice RAG paneli secret göstermez.
- Listing search tool seller email, phone veya ham user/profile bilgisi döndürmez.
- Write tool yoktur.
