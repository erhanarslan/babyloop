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

## Bilinen sınırlamalar

- Rate limit RAG endpoint özelinde henüz ayrılaştırılmadı.
- RAG eval set yok.
- Cevap cache’i yok.
- Backoffice RAG yönetim paneli yok.
- Kaynak dokümanları kısa başlangıç setidir.
- Qdrant Cloud/self-host deployment dokümantasyonu sonraki faza bırakıldı.

## Sonraki işler

- Backoffice RAG paneli
- RAG eval set ve regresyon ölçümü
- Answer cache
- RAG endpoint rate limit
- Qdrant Cloud/self-host deployment rehberi
