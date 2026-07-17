---
id: rag-answer-ownership-map
title: RAG Answer Ownership Map
locale: tr
topic: rag-source-policy
safetyScope: rag-governance
sourceReliability: internal-policy
version: 2026-07-15
---

# RAG Answer Ownership Map

Bu doküman aynı cevabın birden fazla RAG dosyasında çoğalmasını engeller.

## Temel kural

Her canonical soru ailesinin yalnızca bir primary answer owner dokümanı vardır. Diğer dokümanlar:

- kısa referans verebilir
- "detay için owner doküman" mantığında yardımcı olur
- aynı cevabı kopyalamaz
- farklı sonuç doğuracak yeni tavsiye vermez

Runtime policy `apps/api/src/services/rag-answer-owner-registry.ts` içinde typed registry olarak uygulanır. Bu doküman policy'nin insan tarafından okunabilir açıklamasıdır; runtime source of truth registry'dir.

Critical domainlerde owner bulunmazsa sistem başka domain kaynağına veya genel model bilgisine düşmez; no-source döner.

## Owner öncelik sırası

1. `46-illness-red-flags-boundary-canon.md`
   - ateş, hastalık, ilaç, doz, red flag, acil durum

2. `44-feeding-and-food-safety-canon.md`
   - ek gıda, bebek beslenmesi, boğulma riski, bal/tuz/şeker, menü boundary

3. `45-safe-sleep-and-product-boundary-canon.md`
   - güvenli uyku, beşik, park yatak, uyku yüzeyi, ana kucağında uyku

4. `47-second-hand-product-safety-canon.md`
   - recall, ikinci el ürün güvenliği, etiket/model, eksik parça, ürün riski

5. `08-car-seat-second-hand-checklist.md`
   - oto koltuğu spesifik ikinci el kontrol

6. `07-stroller-buying-checklist.md`
   - bebek arabası/puset spesifik kontrol

7. `09-toy-safety-checklist.md`
   - oyuncak spesifik kontrol

8. `05-age-based-product-needs.md` ve yaş dönemi dokümanları
   - yaşa göre ürün ihtiyacı

9. `02-safe-shopping-guide.md`
   - ödeme/mesajlaşma/teslimat güvenliği

10. `01-babyloop-marketplace-guide.md`
   - BabyLoop kullanım akışı

## Çakışma örnekleri

### "6 aylık bebek için ne almalıyım?"

Owner:

- age-based product needs

Neden:

- ürün ihtiyacı sorusu, beslenme değil.

### "6 aylık bebek ne yemeli?"

Owner:

- feeding-and-food-safety-canon

Neden:

- tamamlayıcı beslenme sorusu.

### "6 aylık bebeğe kilo aldıran menü?"

Owner:

- feeding-and-food-safety-canon boundary

Neden:

- kişisel diyet/büyüme sorusu; doktor/diyetisyen yönlendirmesi gerekir.

### "Oto koltuğu ikinci el alınır mı?"

Owner:

- car-seat-second-hand-checklist
- second-hand-product-safety-canon yardımcı kaynak

Neden:

- ürün spesifik risk yüksek.

### "Oto koltuğu kesin güvenli mi?"

Owner:

- car-seat-second-hand-checklist
- forbidden phrase: "kesin güvenlidir", "hiç risk yok"

### "Beşik ikinci el alınır mı?"

Owner:

- safe-sleep-and-product-boundary-canon

Neden:

- uyku ürünü ve safe sleep boundary var.

### "Satıcı yanlış ürün gönderdi"

Owner:

- marketplace dispute and reporting guide

Neden:

- sağlık/ürün güvenliği değil, platform anlaşmazlık akışı.

## RAG prompt routing notları

Asistan cevap üretirken:

- high-risk sağlık sinyali varsa önce boundary owner seçilir.
- product safety sinyali varsa official-referenced source owner aranır.
- marketplace sinyali varsa internal policy owner aranır.
- kaynak yoksa no_source döner.
- tek kaynak düşük confidence ise "sınırlı kaynak" dili kullanılır.
- cevapta kaynak konusu ve boundary açık kalır.

## Doküman çoğaltma yasağı

Aşağıdaki içerikler birden fazla dosyada uzun uzun tekrar edilmez:

- 6 ay ek gıda başlangıç çerçevesi
- güvenli uyku ABC/firm-flat-back ilkesi
- oto koltuğu ikinci el checklist
- recall kontrolü
- ilaç/doz boundary
- menü/diyet boundary
- "kesin güvenli" yasağı

Bunlar ilgili owner dokümanlarda tutulur.
