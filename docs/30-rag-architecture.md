# BabyLoop RAG mimarisi

BabyLoop RAG katmanı, asistanın BabyLoop bilgi tabanındaki kaynaklara dayanarak kısa ve güvenli cevap vermesi için kuruldu. Amaç tıbbi danışmanlık değildir; kapsam marketplace kullanımı, güvenli alışveriş, ilan hazırlama, ürün kontrol listeleri, yaş dönemine göre genel ürün ihtiyaçları ve BabyLoop kullanım rehberidir.

## Stack

- Markdown bilgi tabanı: `docs/rag/*.md`
- Chunking: deterministik markdown heading tabanlı splitter
- Embedding: Gemini `gemini-embedding-001`
- Vector store: Qdrant
- Cevap üretimi: Gemini `gemini-2.5-flash`
- API: Fastify, `/api/v1/rag/search` ve `/api/v1/assistant/messages`

LangChain bu fazda eklenmedi; mevcut ihtiyaç deterministik ve küçük bir markdown pipeline ile karşılanıyor.

## Local Qdrant

Docker compose ile:

```bash
pnpm dev:infra
```

Tek başına:

```bash
docker run -p 6333:6333 -v "$(pwd)/.data/qdrant:/qdrant/storage" qdrant/qdrant
```

## Env değişkenleri

```env
RAG_ENABLED=true
RAG_VECTOR_STORE=qdrant
RAG_QDRANT_URL=http://localhost:6333
RAG_QDRANT_API_KEY=
RAG_QDRANT_COLLECTION=babyloop_rag
RAG_QDRANT_VECTOR_SIZE=3072
RAG_EMBEDDING_PROVIDER=gemini
RAG_EMBEDDING_MODEL=gemini-embedding-001
RAG_CHAT_PROVIDER=gemini
RAG_CHAT_MODEL=gemini-2.5-flash
RAG_MIN_SCORE=0.72
RAG_MAX_CHUNKS=5
RAG_MAX_SOURCES_PER_DOCUMENT=2
RAG_MAX_CONTEXT_CHARS=8000
RAG_REQUIRE_SOURCES=true
RAG_REDIS_ENABLED=false
RAG_REDIS_URL=redis://localhost:6379
RAG_REDIS_KEY_PREFIX=babyloop:rag
RAG_REDIS_CONNECT_TIMEOUT_MS=1000
RAG_CACHE_ENABLED=true
RAG_CACHE_BACKEND=memory
RAG_CACHE_TTL_SECONDS=900
RAG_CACHE_MAX_ENTRIES=200
RAG_USAGE_LIMITS_ENABLED=true
RAG_USAGE_LIMITS_BACKEND=memory
RAG_HOURLY_GUEST_LIMIT=10
RAG_DAILY_GUEST_LIMIT=20
RAG_HOURLY_USER_LIMIT=50
RAG_DAILY_USER_LIMIT=100
RAG_ADMIN_LIMIT_BYPASS=true
RAG_METRICS_ENABLED=true
RAG_METRICS_BACKEND=memory
RAG_LIVE_EVAL_ENABLED=false
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
RAG_GOVERNANCE_TEXT_PREVIEW_CHARS=280
GEMINI_API_KEY=
GEMINI_API_ENDPOINT=https://generativelanguage.googleapis.com
```

`GEMINI_API_KEY` server-side kalır. `NEXT_PUBLIC_GEMINI_API_KEY` kullanılmaz.

## Ingestion

```bash
pnpm --filter @babyloop/api rag:ingest
```

Script:

1. `docs/rag` markdown dosyalarını okur.
2. Frontmatter metadata çıkarır.
3. Heading tabanlı chunk üretir.
4. Gemini embedding üretir.
5. Qdrant collection yoksa oluşturur.
6. Deterministik point id ile upsert yapar.

Gemini embedding çıktısı mevcut `gemini-embedding-001` modeliyle 3072 boyuttur. `RAG_QDRANT_VECTOR_SIZE` bu değerle eşleşmelidir. Model değişirse collection vector size da yeniden oluşturulmalıdır.

`RAG_MAX_SOURCES_PER_DOCUMENT`, aynı dokümandan çok benzer chunk tekrarlarını sınırlamak için kullanılır. Varsayılan değer `2` olduğu için cevap kaynakları farklı doküman ve bölümlere daha dengeli yayılır.

## Search endpoint

`POST /api/v1/rag/search`

```json
{
  "query": "Bebek arabası alırken nelere bakmalıyım?",
  "limit": 5
}
```

Yanıt:

```json
{
  "ok": true,
  "data": {
    "query": "Bebek arabası alırken nelere bakmalıyım?",
    "results": [
      {
        "score": 0.83,
        "text": "...",
        "citation": {
          "title": "Ürün seçimi kontrol rehberleri",
          "sourcePath": "docs/rag/04-product-buying-guides.md",
          "section": "Bebek arabası",
          "topic": "product-buying"
        }
      }
    ]
  }
}
```

RAG kapalıysa endpoint kontrollü `RAG_UNAVAILABLE` döner.

## Operations endpoints

Admin korumalı RAG operasyon endpointleri `/api/v1/admin/rag/*` altında bulunur. Bu endpointler `ai_ops_view` yetkisi ister ve secret, API key, raw prompt, system prompt veya full vector döndürmez.

- `GET /api/v1/admin/rag/health`: RAG açık/kapalı durumu, Qdrant collection özeti, doküman sayıları ve güvenli config summary.
- `GET /api/v1/admin/rag/documents`: `docs/rag` markdown dosyaları, topic, sourceReliability, version, chunk estimate ve metadata durumu.
- `GET /api/v1/admin/rag/documents/:documentId/chunks`: doküman chunk önizlemeleri. Raw vector veya full embedding dönmez.
- `GET /api/v1/admin/rag/reindex/check`: stale/missing/unknown ve reindex gerekli doküman sayıları.
- `GET /api/v1/admin/rag/eval/cases`: eval case listesi.
- `POST /api/v1/admin/rag/eval/run`: mock veya live eval çalıştırır.
- `GET /api/v1/admin/rag/cache/stats`: cache backend/effective backend ve hit/miss istatistikleri.
- `POST /api/v1/admin/rag/cache/clear`: cache temizler.
- `GET /api/v1/admin/rag/metrics`: günlük RAG/assistant/search/cache/rate-limit sayaçları.
- `GET /api/v1/admin/rag/usage`: aktif usage limit backend’i ve limitleri.

Backoffice `/rag` ekranı bu endpointleri kullanarak durum, doküman, cache ve eval bilgilerini gösterir.

## Knowledge governance

Knowledge governance katmanı `docs/rag` markdown bilgi tabanının kalite ve index durumunu izler.

Her dokümanda required frontmatter alanları:

- `id`
- `title`
- `locale`
- `topic`
- `safetyScope`
- `sourceReliability`
- `version`

Geçerli `sourceReliability` değerleri:

- `internal-policy`
- `internal`
- `editorial`
- `official-source-note`
- `official-referenced`

Governance summary şu alanları üretir:

- `checksum`: dokümanın normalized metadata + content SHA-256 değeri.
- `checksumShort`: checksum’ın kısa backoffice gösterimi.
- `chunkCountEstimate`: mevcut deterministic splitter ile tahmini chunk sayısı.
- `missingMetadataFields`: eksik veya geçersiz metadata alanları.
- `indexingStatus`: `indexed`, `stale`, `missing`, `unknown`.
- `reindexRequired`: index güncel değilse true.
- `lastIndexedAt`: Qdrant payload’da görülen son index zamanı.

`indexingStatus` kuralları:

- `indexed`: Qdrant payload checksum, version ve chunk count mevcut dokümanla eşleşir ve `indexedAt` vardır.
- `stale`: Qdrant’ta point vardır ama checksum/version/chunk count eksik veya farklıdır. Eski payload’larda checksum olmadığı için stale görünebilir.
- `missing`: doküman için Qdrant point yoktur.
- `unknown`: Qdrant erişilemez veya snapshot okunamaz.

Ingestion sırasında Qdrant payload’a şu metadata eklenir:

- `documentId`
- `documentTitle`
- `sourcePath`
- `section`
- `topic`
- `safetyScope`
- `sourceReliability`
- `version`
- `checksum`
- `checksumShort`
- `chunkId`
- `chunkIndex`
- `indexedAt`
- `contentLength`

Bu alanlar collection schema migration gerektirmez; Qdrant payload olarak taşınır. Eski payload’lar okunmaya devam eder ama governance panelinde stale/unknown görünebilir.

Backoffice RAG paneli doküman kalitesi için checksum, indexingStatus, reindexRequired, missing metadata ve chunk preview gösterir. Chunk preview sadece kısa metin önizlemesi döndürür; raw vector, embedding veya secret içermez.

## Assistant entegrasyonu

`POST /api/v1/assistant/messages` RAG açıkken şu sırayı izler:

1. Kullanıcı mesajını alır.
2. PII redaction uygular: e-posta, telefon ve token benzeri değerler maskelenir.
3. Scope/safety kontrolü yapar.
4. Prompt injection denemelerini bloklar.
5. Güvenli kapsamdaysa RAG search çalıştırır.
6. Kaynak yoksa cevap uydurmaz.
7. Kaynak varsa Gemini ile yalnızca kaynaklara dayalı kısa Türkçe cevap üretir.
8. Response içinde `sources`, `mode` ve `grounded` alanlarını opsiyonel olarak döndürür.

RAG kapalıysa mevcut assistant provider davranışı korunur.

## Redis, cache ve usage limit

Redis opsiyoneldir. Local default memory backend’tir. Production çoklu instance ortamında Redis önerilir.

Cache backend:

- `memory`
- `redis`
- `disabled`

`RAG_CACHE_BACKEND=redis` seçili ama Redis erişilemezse uygulama crash etmez; servis effective backend’i memory’ye düşürür. Cache key normalize/redacted query, intent, locale ve config/model versiyon bilgisinden hash üretir. Ham prompt, API key veya embedding vector cache key’e girmez.

Usage limit şimdilik in-memory foundation seviyesindedir:

- hourly guest/user
- guest limit: `RAG_DAILY_GUEST_LIMIT`
- user limit: `RAG_DAILY_USER_LIMIT`
- admin bypass: `RAG_ADMIN_LIMIT_BYPASS`

Guest identifier raw IP olarak saklanmaz; SHA-256 hash kullanılır. Redis backend aktifse sayaçlar Redis `INCR` + expire ile tutulur.

## Metrics

RAG metrics günlük bucket ile tutulur. Memory default, Redis opsiyoneldir.

Sayaçlar:

- totalRequests
- assistantRequests
- searchRequests
- ragResponses
- boundaryResponses
- noSourceResponses
- listingToolResponses
- cacheHits/cacheMisses
- rateLimitedRequests
- evalMockRuns/liveEvalRuns/liveEvalBlocked
- byIntent/byMode/byTopic

Metrics hatası ana request’i bozmaz.

## Eval runner

Eval runner iki mod destekler:

- `mock`: gerçek Gemini/Qdrant çağırmaz, deterministik kalite kontrolü yapar.
- `live`: gerçek RAG assistant akışını kullanır; kota kullanabileceği için `RAG_LIVE_EVAL_ENABLED=true` olmadan çalışmaz.

Eval sonuçlarında mode mismatch, required source topic eksikleri, forbidden phrase, source yokluğu, düşük skor ve beklenmeyen hata issue olarak raporlanır.

## Read-only tools

Assistant tool registry sadece read-only araçlar içerir:

- `rag_search`: RAG search service çağırır.
- `category_lookup`: BabyLoop odaklı kategori eşleştirme döndürür.
- `listing_search`: public active/reserved listing sorgusuna güvenli şekilde bağlanır ve yalnızca safe listing summary DTO döndürür.
- `child_age_band_explain`: yaş bandını genel ürün ihtiyacı diliyle açıklar.

Write action yoktur. Saved search oluşturma, favori ekleme, mesaj gönderme ve ilan güncelleme kullanıcı onayı/audit gerektirdiği için sonraki faza bırakılmıştır.

## Retrieval quality

Retrieval kalite motoru dense vector search sonucunu kırmadan deterministik bir hybrid-lite katman ekler.

### Query normalization

`rag-query-normalizer.service.ts` kullanıcı sorgusunu retrieval için analiz eder:

- Türkçe lowercase ve whitespace normalization.
- Kontrollü noktalama temizliği.
- Typo/synonym canonicalization: `bebek arabasi`, `puset`, `stroller` -> `bebek arabası`; `oto koltugu` -> `oto koltuğu`; `ana kucagi` -> `ana kucağı`.
- Product signal extraction: bebek arabası, oto koltuğu, oyuncak, beşik, park yatak, tekstil, ayakkabı, scooter, bisiklet, kanguru, biberon vb.
- Age signal extraction: yenidoğan, 0-3 ay, 6 aylık, 12 aylık, 18 aylık, 2 yaş, okul öncesi vb.
- Topic hint extraction: product-buying, safe-shopping, age-based-needs, listing-writing, messaging-privacy, dispute-reporting, seasonal-needs, recall-safety, second-hand-risk.
- Location signal extraction şehirleri yakalar ama RAG dokümanlarında şehir kapsamı yoksa scoring’i zorlamaz.

Dense embedding için `retrievalQuery` kullanılır. Bu query orijinal metni, canonical ürün terimlerini, yaş sinyallerini ve topic hint’leri birleştirir.

### Hybrid-lite reranking

Gerçek sparse vector migration yapılmadan şu sinyaller final score’a eklenir:

- `vectorScore`: Qdrant dense score, `RAG_VECTOR_SCORE_WEIGHT`.
- `lexicalScore`: query token overlap, `RAG_LEXICAL_SCORE_WEIGHT`.
- `titleMatch`: kaynak başlığında ürün/topic eşleşmesi, `RAG_TITLE_MATCH_BONUS`.
- `sectionMatch`: markdown section eşleşmesi, `RAG_SECTION_MATCH_BONUS`.
- `topicMatch`: query topic hint ile citation topic eşleşmesi, `RAG_TOPIC_MATCH_BONUS`.
- `sourceReliability`: context-aware reliability bonus, `RAG_SOURCE_RELIABILITY_BONUS`.
- duplicate penalty: aynı kaynak/section tekrarlarını aşağı iter, `RAG_DUPLICATE_PENALTY`.

Final score public response’taki mevcut `score` alanına map edilir; response shape breaking şekilde değişmez.

### Context-aware source reliability

- `internal-policy`: boundary, policy ve assistant-boundaries sorgularında öne çıkar.
- `official-source-note`: recall, risk, safety ve yüksek riskli ikinci el ürün sorgularında bonus alır.
- `internal`: BabyLoop kullanım, messaging/privacy, dispute/reporting konularında öne çıkar.
- `editorial`: product-buying, age-based-needs ve seasonal-needs konularında uygundur.

Bu bonus küçük tutulur; ürün checklist sorgularında policy dokümanlarının gereksiz baskın gelmesi engellenir.

### Dedup ve no-source discipline

- Aynı `sourcePath + section` tekrarları collapse edilir.
- Aynı dokümandan dönen kaynak sayısı `RAG_MAX_SOURCES_PER_DOCUMENT` ile sınırlanır.
- Best final score `RAG_NO_SOURCE_MIN_SCORE` altındaysa sonuç dönmez.
- `RAG_MIN_SOURCE_COVERAGE` kadar yeterli kaynak yoksa no-source fallback uygulanır.
- Alakasız teknik sorgularda dense sonuç yüksek gelse bile lexical/topic sinyal yoksa kaynaklı cevap uydurulmaz.

Bu hâlâ gerçek sparse+dense search değildir; hızlı, deterministik ve schema kırmayan bir kalite katmanıdır. Gelecekte Qdrant sparse vector, BM25/hybrid search ve model-based reranker eklenebilir.

## Güvenlik sınırları

Asistan şunları vermez:

- tıbbi tanı
- ilaç önerisi
- tedavi planı
- terapi yönlendirmesi
- diyet planı
- sağlık konusunda kesin hüküm

Bu kapsamda soru gelirse Gemini çağrısı yapılmadan kısa sınır cevabı döner.

## Prompt injection guard

Basit kural tabanlı guard şu tür istekleri engeller:

- önceki talimatları unut
- system prompt’u göster
- developer message’ı yaz
- kaynakları yok say
- RAG kurallarını bypass et

Yanıt BabyLoop bilgi tabanı kapsamına geri çeker.

## Source reliability metadata

Her markdown dokümanı `sourceReliability` frontmatter alanı taşır:

- `internal-policy`
- `official-source-note`
- `internal`
- `editorial`

Asistan kaynak yoksa cevap uydurmaz. İkinci el ürünlerde kesin güvenlik garantisi vermez.

## Bilinen sınırlamalar

- Memory cache/usage/metrics çoklu instance production ortamında merkezi değildir; Redis production için önerilir.
- Redis client küçük RESP wrapper’dır; managed Redis cluster/sentinel topolojileri bu fazda hedeflenmedi.
- Live eval Gemini/Qdrant kotası kullanır ve varsayılan olarak kapalıdır.
- Listing search tool sadece read-only public listing özetleri döndürür; write action yoktur.
- Retrieval heuristic reranker değildir.
- Hybrid-lite scoring gerçek sparse vector search değildir.
- Query normalization deterministiktir; agresif stemming yapmaz, bu yüzden bazı serbest metin varyasyonları hâlâ kaçabilir.
- Resmi kaynak notları derin dış kaynak araştırmasıyla zenginleştirilebilir.

## Sonraki işler

- Hybrid sparse+dense search
- Proper reranker
- Knowledge Base Governance
- MCP server
- Production Redis cache/rate limit
- Daha derin official source research
