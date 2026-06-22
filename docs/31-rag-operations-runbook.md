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

## Knowledge governance

Backoffice `/rag` ekranındaki doküman tablosu metadata kalitesi ve index durumunu gösterir.

### Required frontmatter

Her `docs/rag/*.md` dosyasında şu alanlar olmalıdır:

```yaml
id: safe-shopping-guide
title: Güvenli alışveriş rehberi
locale: tr
topic: safe-shopping
safetyScope: marketplace-guidance
sourceReliability: internal
version: 2026-06-18
```

Geçerli `sourceReliability` değerleri:

- `internal-policy`
- `internal`
- `editorial`
- `official-source-note`
- `official-referenced`

Metadata eksikse backoffice satırında `metadata eksik` görünür. Eksik alan frontmatter’a eklenip doküman yeniden ingest edilmelidir.

### Checksum ve indexedAt

Ingestion sırasında doküman metadata + content üzerinden SHA-256 checksum hesaplanır ve Qdrant payload’a `checksum`, `checksumShort`, `indexedAt`, `version` ve `chunkCount` ile karşılaştırmaya yarayan metadata yazılır.

Reingest:

```bash
set -a
source .env.local
set +a
PATH=/Users/erhan-pc-mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @babyloop/api rag:ingest
```

Reingest sonrası aynı doküman için checksum ve indexedAt güncellenir.

### indexingStatus yorumlama

- `indexed`: Qdrant payload checksum/version/chunk count güncel.
- `stale`: Qdrant point var ama checksum/version/chunk count güncel değil veya eski payload alanları eksik.
- `missing`: doküman için Qdrant point yok.
- `unknown`: Qdrant snapshot okunamadı. Qdrant kapalı olabilir veya bağlantı geçici olarak başarısızdır.

Eski Qdrant payload’larında checksum ve indexedAt bulunmadığı için dokümanlar stale görünebilir. Çözüm: RAG ingestion komutunu yeniden çalıştır.

### Chunk preview

Backoffice doküman satırındaki `Chunk önizle` butonu kısa chunk önizlemelerini gösterir:

- chunk index
- section
- topic
- sourceReliability
- kısa textPreview

Raw vector, embedding, system prompt veya secret gösterilmez.

## RAG playground kullanımı

Backoffice `/rag` ekranındaki RAG Playground, production kullanıcı akışını bozmadan retrieval kalitesini incelemek içindir.

İlgili env:

```env
RAG_PLAYGROUND_ENABLED=true
RAG_EVAL_HISTORY_MAX_RUNS=20
RAG_REINDEX_ACTION_ENABLED=false
```

1. Test sorusunu yaz.
2. `Sadece kaynakları getir` moduyla önce retrieval sonucunu kontrol et.
3. Gerekirse `Cevap önizlemesi üret` moduna geç.

Arama modu dış model cevabı üretmez. Cevap önizlemesi modu mevcut RAG assistant flow’unu kullanır; gerçek Gemini çağrısı yapabilir ve kota kullanabilir.

### Query analizi nasıl okunur?

- `normalized`: Türkçe normalization ve typo/synonym dönüşümü sonrası sorgu.
- `retrievalQuery`: embedding için kullanılan zenginleştirilmiş sorgu.
- `productTerms`: bebek arabası, oto koltuğu, oyuncak gibi ürün sinyalleri.
- `ageSignals`: 12 ay, 2 yaş, yenidoğan gibi yaş sinyalleri.
- `locationSignals`: şehir sinyalleri. RAG dokümanlarında şehir kapsamı yoksa scoring’i zorlamaz.
- `topicHints`: product-buying, safe-shopping, age-based-needs gibi retrieval topic ipuçları.

### Düşük skor ve no-source

Playground `Kaynak bulunamadı` veya no-source warning gösteriyorsa:

- Sorgu BabyLoop bilgi tabanı kapsamı dışında olabilir.
- `RAG_NO_SOURCE_MIN_SCORE` çok yüksek olabilir.
- İlgili docs/rag dokümanı eksik olabilir.
- Query normalizer yeni bir synonym/ürün sinyali gerektiriyor olabilir.

Kaynak yoksa asistan cevap uydurmamalıdır. Önce docs/rag kapsamını veya retrieval env ayarlarını iyileştir.

### Quality signal yorumlama

- `vektör`: Qdrant dense skorunun rerank öncesi sinyali.
- `sözcük`: query token overlap sinyali.
- `konu`: topic hint ile source topic eşleşmesi.
- `kaynak bonusu`: sourceReliability ve sorgu bağlamına göre küçük güvenilirlik katkısı.

Bu sinyaller diagnostic amaçlıdır; public response’a raw debug olarak eklenmez.

## Eval history

Mock veya live eval çalıştırıldığında backoffice son run kayıtlarını gösterir.

- `mode`: mock veya live.
- `passed/total`: geçen case oranı.
- `failed`: başarısız case sayısı.
- `Detay göster`: başarısız case listesi, issue ve kısa source bilgileri.

History in-memory tutulur ve `RAG_EVAL_HISTORY_MAX_RUNS` ile sınırlanır. Servis restart sonrası kayıtlar kaybolabilir. Kalıcı eval history production hardening için sonraki pakete bırakılmıştır.

Failed case yorumlama:

- `mode_mismatch`: beklenen boundary/rag/no_source modu tutmadı.
- `missing_required_source_topic`: beklenen topic kaynaklarda yok.
- `forbidden_phrase_found`: cevap yasaklı ifade içerdi.
- `no_sources`: RAG beklenen yerde kaynak yok.
- `low_score`: RAG skor eşiği düşük kaldı.
- `live_eval_disabled`: live eval env flag kapalı.

## Tool-Augmented Assistant debug

Assistant answer mode artık bazı sorularda RAG yanında BabyLoop tool'larını kullanabilir. Backoffice Playground answer preview içinde şu alanlara bakılır:

```env
ASSISTANT_TOOLS_ENABLED=true
ASSISTANT_MAX_TOOL_CALLS=3
ASSISTANT_TOOL_TIMEOUT_MS=1500
```

- `intent`: router'ın seçtiği niyet.
- `toolsUsed`: başarıyla çalışan araç adları.
- `toolResultsPreview`: public-safe kısa tool sonucu.
- `suggestedActions`: kullanıcı onayı gerektirmeyen açma/kopyalama/gözden geçirme önerileri.

### listing_search sonuçsuzsa

- Sorguda şehir veya ürün terimi çok dar olabilir.
- İlgili kategori mapping eksik olabilir.
- Public listing query sadece aktif/uygun ilanları döndürüyor olabilir.
- Tool private seller verisi dönmediği için seller email/phone beklenmemelidir.

Asistan sonuç bulamazsa arama sayfasına yönlendiren kısa cevap üretir; sahte ilan uydurmaz.

### Tool failure nasıl yorumlanır?

Tool hataları ana assistant response'u düşürmemelidir. Playground `toolsUsed` içinde beklenen araç yoksa:

- ilgili service callback bağlı olmayabilir,
- tool input schema validasyonu reddetmiş olabilir,
- service geçici hata vermiş olabilir,
- timeout `ASSISTANT_TOOL_TIMEOUT_MS` düşük kalmış olabilir.

Uygulama client'a secret, raw vector, system prompt veya private seller/user verisi göstermez. Detaylı hata kullanıcı yerine server log/observability tarafında secretsız takip edilmelidir.

### Draft-only araçlar

`listing_draft_helper` ve `saved_search_suggest_draft` sadece taslak üretir. İlan oluşturmaz, kayıtlı arama kaydetmez, mesaj göndermez, favori eklemez. Gelecekte write action'lar için kullanıcı onayı ve audit trail gerekecektir.

## Reindex workflow

Backoffice `Reindex workflow` bölümü read-only check ve güvenli full reindex hazırlığı sunar.

Check:

- stale, missing, unknown ve reindexRequired sayılarını gösterir.
- reindex gereken dokümanları kısa listeler.

Full reindex:

1. Confirm alanına `REINDEX_RAG` yaz.
2. `Full reindex akışını hazırla` butonuna bas.
3. API otomatik child process çalıştırmaz; manuel komut döndürür:

```bash
pnpm --filter @babyloop/api rag:ingest
```

Production’da reindex job queue veya workflow runner ile yapılmalıdır. Bu paket yanlışlıkla uzun ingestion işini API request içinde başlatmaz.

## Güvenlik notları

- API key, raw prompt, system prompt ve embedding vector loglanmaz.
- Backoffice RAG paneli secret göstermez.
- Listing search tool seller email, phone veya ham user/profile bilgisi döndürmez.
- Write tool yoktur.
