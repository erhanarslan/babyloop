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
RAG_CACHE_ENABLED=true
RAG_CACHE_TTL_SECONDS=900
RAG_CACHE_MAX_ENTRIES=200
RAG_DAILY_GUEST_LIMIT=20
RAG_DAILY_USER_LIMIT=100
RAG_LIVE_EVAL_ENABLED=false
RAG_TOPIC_MATCH_BONUS=0.03
RAG_SOURCE_RELIABILITY_BONUS=0.02
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
- `GET /api/v1/admin/rag/eval/cases`: eval case listesi.
- `POST /api/v1/admin/rag/eval/run`: mock veya live eval çalıştırır.
- `GET /api/v1/admin/rag/cache/stats`: in-memory cache istatistikleri.
- `POST /api/v1/admin/rag/cache/clear`: cache temizler.

Backoffice `/rag` ekranı bu endpointleri kullanarak durum, doküman, cache ve eval bilgilerini gösterir.

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

## Cache ve usage limit

RAG assistant cevapları kısa süreli in-memory cache’e alınabilir. Cache key; redacted ve normalize edilmiş mesaj, intent ve locale bilgisinden oluşur. Ham prompt, API key veya embedding vector cache key’e girmez.

Usage limit şimdilik in-memory foundation seviyesindedir:

- guest limit: `RAG_DAILY_GUEST_LIMIT`
- user limit: `RAG_DAILY_USER_LIMIT`

Production için Redis veya edge-compatible merkezi limit deposu sonraki faza bırakılmıştır.

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

Retrieval katmanı şu heuristic iyileştirmeleri uygular:

- Aynı document+section tekrarlarını azaltır.
- Aynı dokümandan dönen kaynak sayısını `RAG_MAX_SOURCES_PER_DOCUMENT` ile sınırlar.
- Intent/topic eşleşmesinde küçük bonus uygular.
- `sourceReliability` metadata’sına göre küçük güvenilirlik bonusu uygular.

Bu bir reranker değildir; hızlı ve deterministik kalite katmanıdır. Hybrid sparse+dense search ve proper reranker sonraki fazların konusudur.

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

- Cache ve usage limit in-memory olduğu için çoklu instance production ortamında merkezi değildir.
- Live eval Gemini/Qdrant kotası kullanır ve varsayılan olarak kapalıdır.
- Listing search tool sadece read-only public listing özetleri döndürür; write action yoktur.
- Retrieval heuristic reranker değildir.
- Resmi kaynak notları derin dış kaynak araştırmasıyla zenginleştirilebilir.

## Sonraki işler

- Hybrid sparse+dense search
- Proper reranker
- MCP server
- Production Redis cache/rate limit
- Daha derin official source research
