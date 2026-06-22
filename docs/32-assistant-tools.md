# BabyLoop Assistant Tools

Bu doküman Tool-Augmented Assistant paketindeki araçları ve güvenlik sınırlarını özetler.

## Temel ilkeler

- Aktif araçlar read-only veya draft-only çalışır.
- Kullanıcı adına write action yoktur.
- Kayıtlı arama oluşturma, mesaj gönderme, favori ekleme ve ilan güncelleme yapılmaz.
- Seller email, telefon, private user/profile id veya açık adres döndürülmez.
- Hidden, blocked veya unsafe listing sonuçları public-safe query katmanından geçmeden gösterilmez.
- Tool hatası assistant cevabını çökertmez; kontrollü fallback üretilir.

## Read-only araçlar

### rag_search

BabyLoop RAG bilgi tabanında kaynaklı arama yapar.

Kullanım:

- güvenli alışveriş
- ürün kontrol listeleri
- ilan yazımı
- BabyLoop kullanım rehberi

### listing_search

Public listing araması yapar ve safe listing summary döndürür.

Dönen alanlar:

- listingId
- title
- price / currency
- category
- condition
- city
- imageUrl
- href
- status

Private seller bilgisi dönmez.

### listing_detail

Tek bir ilan için public-safe özet döndürür.

Dönen alanlar:

- listingId
- title
- descriptionPreview
- price / currency
- category
- condition
- city
- imageCount
- status
- href
- safeSellerSummary

Satıcı email, telefon veya private user id dönmez.

### category_lookup

Ürün terimi veya kullanıcı sorgusunu BabyLoop kategori önerilerine eşler.

### buyer_question_templates

Satıcıya sorulabilecek güvenli soru şablonları üretir.

Örnekler:

- Ürünün kaç yıldır kullanıldığını paylaşabilir misiniz?
- Eksik parçası, kırığı veya onarım geçmişi var mı?
- Güncel ve farklı açılardan fotoğraf paylaşabilir misiniz?

Oto koltuğu gibi yüksek riskli ürünlerde kesin güvenlik iddiası üretmez.

### seller_public_summary

İlan veya public profile üzerinden satıcıya dair private veri içermeyen kısa özet döndürür.

### child_age_band_explain

Yaş ayı veya ageBand bilgisini genel ürün ihtiyacı diliyle açıklar. Sağlık, tanı, tedavi veya diyet önermez.

## Draft-only araçlar

### listing_draft_helper

İlan taslağı üretir:

- başlık önerileri
- açıklama taslağı
- fotoğraf kontrol listesi
- güvenli ilan notları

Gerçek ilan oluşturmaz veya güncellemez.

### saved_search_suggest_draft

Kayıtlı arama taslağı önerir:

- label
- query
- filters
- reason

Gerçek kayıtlı arama oluşturmaz.

## Suggested actions

Assistant response içinde optional `suggestedActions` dönebilir:

- `open_listing`
- `open_search`
- `copy_questions`
- `review_saved_search_draft`
- `review_listing_draft`

Bu action'lar kullanıcı adına yazma işlemi yapmaz. Sadece UI'ın güvenli şekilde açma, kopyalama veya gözden geçirme davranışı sunmasına yardımcı olur.

## Gelecek write action confirmation politikası

Write action'lar ayrı bir fazda ele alınmalıdır:

1. Assistant sadece taslak üretir.
2. Kullanıcı taslağı açıkça görür.
3. Kullanıcı onay verir.
4. Backend audit trail tutar.
5. CSRF/auth/RBAC kontrolleri write endpoint üzerinde uygulanır.

Bu paket write action çalıştırmaz.

## child_needs_recommendations

`child_needs_recommendations` tool'u aktif çocuk profili, ageBand ve mevsim bilgisiyle ürün takip ve kayıtlı arama taslakları üretir. Tool read-only/draft-only çalışır. Çocuk adı/label yalnızca oturumdaki kullanıcıya cevap üretmek için kısa ve sanitize edilmiş şekilde kullanılır; seller/public DTO'lara taşınmaz. Otomatik kayıtlı arama, bildirim veya mesaj oluşturmaz.

## Public suggested actions

Assistant tool orchestration sonucu dönen `suggestedActions`, public UI'da kısa kartlar halinde render edilir. Linkli aksiyonlar ilan veya arama sayfası açar; draft aksiyonları ise çocuk önerisi, kayıtlı arama taslağı veya ilan taslağını gösterir. Bu alanlar write action değildir.

## Child recommendation UI handoff

Çocuk profili önerileri public web'de iki şekilde görünür: assistant `review_child_recommendations` aksiyonları ve `/account/children` lifecycle öneri kartları. İki yüzey de no-write çalışır; notification gönderimi ve saved search oluşturma sonraki paketlerin kontrollü akışına bırakılmıştır.

## Notification preference handoff

Child recommendation ve saved search taslakları artık notification preferences yüzeyinde görünür hale gelir. Assistant ve child profile yüzeyleri kullanıcıyı bu tercihlere yönlendirebilir; hiçbir tool veya public UI kullanıcı onayı olmadan bildirim ya da kayıtlı arama oluşturmaz.
