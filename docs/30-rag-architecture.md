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
RAG_PLAYGROUND_ENABLED=true
RAG_EVAL_HISTORY_MAX_RUNS=20
RAG_REINDEX_ACTION_ENABLED=false
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

## Domain-aware retrieval and grounding hardening

Dense vector search BabyLoop'ta domain router değildir. Yeni assistant akışı şu sırayı izler:

1. Safety/boundary classification
2. Domain ve intent routing
3. Canonical answer owner resolution
4. Metadata-constrained candidate retrieval
5. Hybrid scoring/reranking
6. Cross-domain contamination rejection
7. Grounding sufficiency decision
8. Answer generation veya deterministic canonical composer
9. Claim/answer validation
10. Grounded answer veya fail-closed fallback

`apps/api/src/services/rag-domain-router.service.ts` yaş/cinsiyet sinyalini tek başına ürün ihtiyacı olarak yorumlamaz. Örneğin `6 aylık erkek bebeğe ek gıda ne yedirilir?` domain olarak `feeding`, owner olarak `feeding-and-food-safety-canon` seçer. Bu route altında `child_needs_recommendations`, kategori, listing ve marketplace araçları yasaktır.

`apps/api/src/services/rag-answer-owner-registry.ts` canonical owner policy için runtime source of truth'tur. Feeding gibi critical domainlerde canonical owner bulunmazsa sistem başka yakın-vector sonucu ile cevap üretmez; `insufficient_sources`/`owner_missing` döner.

`RagSearchService` vector adaylarını yalnız candidate generation olarak kullanır. `allowedTopics`, `forbiddenTopics`, `allowedSourcePaths`, `requiredOwner`, `minimumReliability`, `minFinalScore`, `minScoreMargin` ve per-document cap seçenekleri hard filter ve reranking aşamasına taşınır. Qdrant payload yeni indexlerde `answerOwner`, `sectionKind`, `allowedDomains`, `questionFamilies`, `ageBands` ve risk metadata'sını taşıyabilir.

Feeding route için forbidden final context örnekleri:

- `toy-safety`
- `product-buying`
- `seasonal-needs`
- `age-based-needs`
- `listing-writing`
- marketplace kullanım kaynakları

Bu yüzden yüksek vector skorlu Montessori/oyuncak chunk'ı, düşük skorlu canonical feeding chunk'ından önce gelse bile final context'e giremez.

## Cache versioning

Assistant cache key artık domain router version, owner registry version, domain ve canonical owner imzasını içerir. Yanlış route ile önceden cache'lenmiş bir cevap yeni router/policy sürümünde tekrar kullanılmaz.

## Blue-green reindex guidance

Production collection üzerinde kör drop yapılmamalıdır. Güvenli reindex akışı:

1. Mevcut collection info al.
2. Versioned yeni collection oluştur.
3. Yeni metadata/chunking ile ingest et.
4. Topic/owner/reliability dağılımını ve chunk count'u doğrula.
5. Golden retrieval smoke çalıştır.
6. Alias/config switch yap.
7. Eski collection'ı rollback için hemen silme.

Bu patch destructive reindex çalıştırmaz; runtime policy, metadata payload ve test/guard sözleşmesini hazırlar.

## Operations endpoints

Admin korumalı RAG operasyon endpointleri `/api/v1/admin/rag/*` altında bulunur. Bu endpointler `ai_ops_view` yetkisi ister ve secret, API key, raw prompt, system prompt veya full vector döndürmez.

- `GET /api/v1/admin/rag/health`: RAG açık/kapalı durumu, Qdrant collection özeti, doküman sayıları ve güvenli config summary.
- `GET /api/v1/admin/rag/documents`: `docs/rag` markdown dosyaları, topic, sourceReliability, version, chunk estimate ve metadata durumu.
- `GET /api/v1/admin/rag/documents/:documentId/chunks`: doküman chunk önizlemeleri. Raw vector veya full embedding dönmez.
- `GET /api/v1/admin/rag/reindex/check`: stale/missing/unknown ve reindex gerekli doküman sayıları.
- `POST /api/v1/admin/rag/reindex/run`: check veya full reindex workflow planı. Full mode `REINDEX_RAG` onayı ister ve varsayılan olarak manuel komut döndürür.
- `POST /api/v1/admin/rag/playground/query`: admin-only search diagnostics veya answer preview üretir.
- `GET /api/v1/admin/rag/eval/cases`: eval case listesi.
- `POST /api/v1/admin/rag/eval/run`: mock veya live eval çalıştırır.
- `GET /api/v1/admin/rag/eval/history`: son eval run kayıtları.
- `GET /api/v1/admin/rag/eval/history/:runId`: tek eval run detayı ve failed case sonuçları.
- `GET /api/v1/admin/rag/cache/stats`: cache backend/effective backend ve hit/miss istatistikleri.
- `POST /api/v1/admin/rag/cache/clear`: cache temizler.
- `GET /api/v1/admin/rag/metrics`: günlük RAG/assistant/search/cache/rate-limit sayaçları.
- `GET /api/v1/admin/rag/usage`: aktif usage limit backend’i ve limitleri.

Backoffice `/rag` ekranı bu endpointleri kullanarak durum, doküman, cache, playground, eval history ve reindex workflow bilgilerini gösterir.

## Admin RAG playground

Backoffice playground admin-only diagnostic yüzeyidir. Public `/rag/search` ve `/assistant/messages` contract’ını değiştirmez.

`search` mode:

- Query normalizer çıktısını gösterir: normalized query, retrieval query, tokenlar, ürün/yaş/konum/topic sinyalleri.
- RAG retrieval sonuçlarını kısa chunk preview ile gösterir.
- Quality signal görünürlüğü sağlar: vector score, lexical score, topic match, source reliability bonus.
- Gemini answer generation yapmaz.

`answer` mode:

- Mevcut RAG assistant flow’unu kullanır.
- Cevap önizlemesi, sources, grounded, intent ve toolsUsed alanlarını gösterir.
- Gerçek model çağrısı yapabilir ve Gemini kotası kullanabilir.

Güvenlik kısıtları:

- raw vector dönmez
- embedding dönmez
- system prompt dönmez
- API key veya secret dönmez
- text preview truncate edilir

## Eval history

Eval run history in-memory tutulur ve `RAG_EVAL_HISTORY_MAX_RUNS` ile sınırlanır. Restart sonrası history kaybolabilir; production persistence sonraki hardening paketine bırakılmıştır.

History kayıtları run id, mode, startedAt/finishedAt, duration, total/passed/failed, status ve case sonuçlarını içerir. Liste endpointi uzun result payload’u döndürmez; detay endpointi failed case incelemesi için kullanılır.

## Reindex workflow

`/admin/rag/reindex/check` read-only governance summary döndürür. `reindex/run` endpointi iki mod destekler:

- `check`: yalnızca summary döndürür.
- `full`: `confirm=REINDEX_RAG` ister ve varsayılan olarak manuel komut döndürür: `pnpm --filter @babyloop/api rag:ingest`.

API process içinde child process ile ingestion başlatılmaz. Production’da job queue tabanlı reindex önerilir.

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

## Tool-Augmented Assistant

Assistant artık RAG cevap akışının yanında güvenli BabyLoop araçlarını da kullanabilir. Bu araçlar public-safe DTO döndürür, private seller/user verisi taşımaz ve kullanıcı adına write action çalıştırmaz.

Aktif read-only araçlar:

- `rag_search`: RAG search service çağırır.
- `category_lookup`: BabyLoop odaklı kategori/product eşleştirme döndürür.
- `listing_search`: public active/reserved listing sorgusuna güvenli şekilde bağlanır ve yalnızca safe listing summary DTO döndürür.
- `listing_detail`: public-safe ilan detay özeti döndürür.
- `seller_public_summary`: ilan veya public profile üzerinden private veri içermeyen satıcı özeti döndürür.
- `child_age_band_explain`: yaş bandını genel ürün ihtiyacı diliyle açıklar.
- `buyer_question_templates`: alıcı için güvenli soru şablonları üretir.

Aktif draft-only araçlar:

- `listing_draft_helper`: ilan başlığı, açıklaması ve fotoğraf kontrol listesi taslağı üretir.
- `saved_search_suggest_draft`: kayıtlı arama taslağı önerir.

Draft-only araçlar gerçek kayıt oluşturmaz, ilan güncellemez ve kullanıcı adına aksiyon almaz. Response içinde `suggestedActions` sadece gözden geçirme/kopyalama/açma niyetini taşır.

Intent router şu marketplace intentlerini ayırır: `listing_search`, `listing_detail`, `listing_help`, `buyer_questions`, `saved_search_suggestion`, `category_lookup`, `seller_summary`, `babyloop_usage`, `child_needs`, `rag_knowledge`. Boundary ve prompt injection kararları her zaman önce çalışır.

Assistant response backward-compatible kalır. Yeni optional alanlar:

- `intent`
- `toolsUsed`
- `toolResultsPreview`
- `suggestedActions`

Write action yoktur. Saved search oluşturma, favori ekleme, mesaj gönderme ve ilan güncelleme kullanıcı onayı/audit gerektirdiği için sonraki faza bırakılmıştır.

### Tool orchestration

`assistant-tool-orchestrator.service.ts` intent'e göre en fazla `ASSISTANT_MAX_TOOL_CALLS` kadar araç çağırır. Her tool için timeout `ASSISTANT_TOOL_TIMEOUT_MS` ile sınırlıdır. Tool hatası asistan cevabını düşürmez; kontrollü fallback üretilir.

İlgili env:

```env
ASSISTANT_TOOLS_ENABLED=true
ASSISTANT_MAX_TOOL_CALLS=3
ASSISTANT_TOOL_TIMEOUT_MS=1500
```

Örnek akışlar:

- “İstanbul’da bebek arabası var mı?” -> `listing_search` + `rag_search`
- “İkinci el oto koltuğu için satıcıya ne sorayım?” -> `buyer_question_templates` + `rag_search`
- “Bebek arabası ilan açıklaması yaz” -> `listing_draft_helper` + `rag_search`
- “Bu aramayı kaydetmek istiyorum” -> `saved_search_suggest_draft`
- “Hangi kategoriye koymalıyım?” -> `category_lookup`

Backoffice RAG Playground answer mode varsa `intent`, `toolsUsed`, `toolResultsPreview` ve `suggestedActions` alanlarını gösterir. Public web bu alanları yok sayabilir; contract breaking change yoktur.

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
- `official-referenced`
- `internal`
- `editorial`

Asistan kaynak yoksa cevap uydurmaz. İkinci el ürünlerde kesin güvenlik garantisi vermez.

## Bilinen sınırlamalar

- Memory cache/usage/metrics çoklu instance production ortamında merkezi değildir; Redis production için önerilir.
- Redis client küçük RESP wrapper’dır; managed Redis cluster/sentinel topolojileri bu fazda hedeflenmedi.
- Live eval Gemini/Qdrant kotası kullanır ve varsayılan olarak kapalıdır.
- Listing search tool sadece read-only public listing özetleri döndürür; write action yoktur.
- Tool-augmented assistant sadece read-only veya draft-only araçları çalıştırır; gerçek write action confirmation mimarisi henüz yoktur.
- Retrieval heuristic reranker değildir.
- Hybrid-lite scoring gerçek sparse vector search değildir.
- Admin playground answer mode gerçek model çağrısı yapabilir ve kota kullanabilir.
- Eval history bu fazda in-memory tutulur; servis restart sonrası kaybolabilir.
- Reindex workflow API içinde otomatik ingestion çalıştırmaz; güvenli manuel komut veya ileride job queue önerilir.
- Query normalization deterministiktir; agresif stemming yapmaz, bu yüzden bazı serbest metin varyasyonları hâlâ kaçabilir.
- Resmi kaynak notları derin dış kaynak araştırmasıyla zenginleştirilebilir.

## Sonraki işler

- Hybrid sparse+dense search
- Proper reranker
- Backoffice RAG Playground
- Tool-Augmented Assistant
- Child Profile Personalization
- Eval/Red Team Reports
- MCP server
- Production Redis cache/rate limit
- Daha derin official source research

## Assistant child personalization

Paket 6 ile assistant, oturum açmış kullanıcı için aktif çocuk profili bağlamını read-only olarak kullanabilir. Bu bağlam yalnızca yaş bandı, güvenli label, bildirim sıklığı ve lifecycle kategori önerileri gibi privacy-light alanlardan oluşur. Çocuk profili verisi seller/public DTO'lara taşınmaz; öneriler sağlık, tanı, tedavi veya gelişim değerlendirmesi üretmez. Tool çıktıları kayıtlı arama ve bildirim için sadece taslak üretir; kullanıcı onayı olmadan write action yapılmaz.

## Public assistant suggested actions

Public assistant UI artık assistant response içindeki `suggestedActions` alanını güvenli kartlar olarak gösterebilir. `review_child_recommendations` ve `review_saved_search_draft` aksiyonları yalnızca taslak/önizleme davranışıdır; kayıtlı arama, bildirim, favori, mesaj veya ilan kullanıcı onayı olmadan oluşturulmaz.

## Child lifecycle recommendations surface

`/account/children` sayfası aktif çocuk profili için lifecycle recommendation endpoint'inden gelen kategori önerilerini gösterir. Bu yüzey yalnızca read-only öneri ve CTA üretir: kullanıcı ilan aramasına veya asistana yönlendirilir. Kayıtlı arama veya bildirim kullanıcı onayı olmadan oluşturulmaz.

## Notification preferences surface

`/account/notification-preferences` sayfası çocuk profili cadence değerlerini, lifecycle recommendation tabanlı bildirim taslaklarını ve kayıtlı arama bildirim durumlarını tek yerde gösterir. Bu yüzey no-write çalışır; gerçek email/push/n8n gönderimi sonraki delivery paketine bırakılmıştır.

## Saved search notification toggle

`PATCH /api/v1/saved-searches/:savedSearchId/notifications` endpoint'i kayıtlı arama bildirim tercihinin açılıp kapatılmasını sağlar. Bu endpoint yalnızca kullanıcının kendi kayıtlı aramasında `notificationsEnabled` alanını günceller; bildirim göndermez, delivery log oluşturmaz ve match hesaplaması yapmaz. Gerçek gönderim bir sonraki delivery paketinde ayrı kontrol edilecektir.

## Notification delivery drafts

`GET /api/v1/notifications/delivery-drafts` endpoint'i oturum açmış kullanıcı için çocuk lifecycle ve kayıtlı arama tabanlı no-write bildirim taslakları üretir. Endpoint email, push, n8n, queue veya delivery log çalıştırmaz. Bu endpoint sonraki gerçek delivery paketinde dedup/frequency/send-log süreçlerinin güvenli girdisi olacaktır.

## Backoffice notification ops preview

`GET /api/v1/admin/notifications/ops-preview` ve backoffice `/notifications` sayfası notification delivery adaylarının operasyonel görünürlüğünü sağlar. Bu görünüm yalnızca aggregate candidate count ve delivery policy gösterir; email, push, n8n, queue veya delivery log çalıştırmaz.

## Notification delivery policy foundation

Notification delivery draft'ları artık dedup key ve frequency window metadata'sı taşır. `evaluateNotificationDeliveryPolicy` tüm adaylarda `deliveryAllowed=false` ve `draftOnly=true` döndürür. Gerçek delivery açılmadan önce delivery log, frequency limiter, idempotency key ve admin audit zorunludur.

## Production image storage foundation

Listing image upload now goes through an image storage abstraction. `IMAGE_STORAGE_DRIVER=local` keeps the existing `/api/v1/uploads/listings` local file route. `IMAGE_STORAGE_DRIVER=s3` stores listing images in an S3/R2-compatible bucket and returns the configured `IMAGE_STORAGE_PUBLIC_BASE_URL` URL. The storage ops endpoint only exposes safe driver/config status and never returns credentials.

## Backoffice storage ops preview

Backoffice `/storage` page reads `GET /api/v1/admin/storage/ops-preview` and displays safe image storage driver status. The page does not expose S3/R2 credentials, object keys beyond public URLs, or raw image binary data.

## Email provider foundation

Email delivery now has a provider abstraction with `EMAIL_PROVIDER=mock|smtp|resend`. Real SMTP sending is gated by `EMAIL_SEND_ENABLED=true`; when disabled, the provider remains sandbox-only. It validates configuration and exposes only safe ops metadata through `GET /api/v1/admin/email/ops-preview` without leaking secrets. Admin-only `POST /api/v1/admin/email/test-send` can send a controlled smoke-test draft; it does not create verification/reset tokens and real SMTP still requires `EMAIL_SEND_ENABLED=true`.

## Mobile notification boundary

Mobile notifications are locked by `pnpm security:mobile-notifications`.

The mobile boundary is:

- authenticated in-app notification list,
- unread count,
- mark-one-read and mark-all-read,
- child lifecycle in-app generation,
- child notification cadence preference display,
- safe notification cards without token/session/raw e-mail leaks.

This is a draft-only/email/push/n8n boundary. Mobile UI and API tests may show notification preferences and in-app notification results, but they must not claim native push, email delivery, n8n hooks, queues, or provider delivery until the dedicated delivery-log/idempotency package is implemented.

## Notification delivery log foundation

`notification_delivery_logs` is the persistence foundation for the notification delivery pipeline. It records candidate delivery attempts with a unique idempotency key, dedup key, frequency window metadata, `deliveryAllowed=false`, and `draftOnly=true`.

This is still not a sender. The foundation only makes duplicate/frequency/idempotency behavior testable before email, push, queue, or n8n delivery is connected. `pnpm security:notification-delivery-log` protects this boundary.

## Child reminder delivery candidate pipeline

The child reminder delivery candidate pipeline converts scheduled child reminders into notification delivery candidate logs. It uses `kind=child_reminder`, the existing `notification_delivery_logs` idempotency key, dedup key, and frequency window foundation.

The pipeline keeps `deliveryAllowed=false` and `draftOnly=true`. It does not send email, push, n8n webhooks, queue jobs, or provider calls. `pnpm security:child-reminder-delivery` protects this email/push/n8n boundary.

## Saved-search delivery candidate pipeline

The saved-search delivery candidate pipeline converts saved-search/listing matches into notification delivery candidate logs. It uses `kind=saved_search`, a stable savedSearchId/listingId source id, and the existing `notification_delivery_logs` idempotency key, dedup key, and frequency window foundation.

The pipeline keeps `deliveryAllowed=false` and `draftOnly=true`. It does not send email, push, n8n webhooks, queue jobs, or provider calls. `pnpm security:saved-search-delivery` protects this email/push/n8n boundary.

## Notification delivery-log ops preview

Backoffice `GET /api/v1/admin/notifications/ops-preview` now includes a notification delivery-log ops preview. It exposes aggregate counts by status, kind, and channel plus recent rows with redacted source refs.

The preview intentionally excludes metadata, idempotency key, dedup key, e-mail, token, cookie, authorization, and raw body values. It remains an ops visibility surface only and does not enable email/push/n8n senders, queues, provider calls, or delivery transitions. Guard: `pnpm security:notification-ops-preview`.

## Notification delivery transition model

The notification delivery transition model defines draft-only status movement for `notification_delivery_logs`. In the current phase, safe transitions are limited to candidate/block/skip flows. `sent/failed` remains future-only and blocked until provider sandbox, retry/dead-letter policy, idempotency enforcement, and admin audit exist.

Backoffice notification ops preview exposes the transition model so admins can see why real delivery is still disabled. The model keeps `deliveryAllowed=false` and `draftOnly=true`; it does not enable email/push/n8n senders, queues, webhooks, or provider calls. Guard: `pnpm security:notification-delivery-transitions`.

## Native push readiness

Native push readiness is an ops/planning preview only. It documents the prerequisites before a mobile push sender can exist: native device token registry, device-level consent, platform token validation/revocation, delivery transition model, delivery log idempotency, provider sandbox, retry/dead-letter policy, admin audit, and rate limits.

The current state remains blocked with `deliveryAllowed=false`, `draftOnly=true`, `pushSenderEnabled=false`, `providerConfigured=false`, `tokenRegistryEnabled=true`, and `tokenCollectionAllowed=false`. Token registry storage is hash-only and redacted; no native token collection, Expo/Firebase/APNs provider call, queue, n8n hook, webhook, or sender is enabled. Guard: `pnpm security:notification-push-readiness`.

## n8n workflow readiness

n8n workflow readiness is an ops/planning preview only. It documents prerequisites before workflow delivery can exist: versioned webhook contract, idempotency header, signed payload, delivery transition model, delivery log candidate source, queue/worker, retry/dead-letter policy, admin audit, rate limit, and consent model.

The current state remains blocked with `deliveryAllowed=false`, `draftOnly=true`, `n8nWorkflowEnabled=false`, `webhookConfigured=false`, `webhookCallsAllowed=false`, and `queueEnabled=false`. Existing child lifecycle, child reminder, and saved-search candidate logs are workflow candidates only; no n8n webhook, queue, worker, email, push, provider call, or real workflow trigger is enabled. Guard: `pnpm security:notification-n8n-readiness`.

## Assistant safety guard

Assistant/RAG work must pass `pnpm security:assistant-safety-guard`. The guard requires grounding/source IDs for specific claims and blocks medical diagnosis, medication/dosage advice, treatment plans, diet prescriptions, therapy claims, and unsupported product safety claims.

The allowed scope remains everyday parenting checklists, age-band shopping reminders, comfort/routine suggestions, and safe human referral prompts. This package does not enable autonomous RAG answers; it is a hallucination and safety boundary layer.

## Notification surface consistency audit

Run pnpm security:notification-consistency-audit before claiming notification release readiness.

This broad audit covers API, web, mobile, and backoffice notification surfaces. It requires deliveryAllowed=false, draftOnly=true, email/push/n8n disabled copy, notification preferences, delivery drafts, push readiness, n8n readiness, observability, and manual QA boundaries to stay aligned.

This audit does not enable real email sending, does not enable real push sending, and does not enable real n8n workflow triggering. It does not enable queues, provider calls, webhook calls, native push token collection, or production notification delivery.
