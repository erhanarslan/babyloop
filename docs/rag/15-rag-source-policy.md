---
id: rag-source-policy
title: BabyLoop RAG kaynak politikası
locale: tr
topic: rag-source-policy
safetyScope: marketplace-guidance
sourceReliability: internal-policy
version: 2026-06-21
---

## Runtime owner-first retrieval rule

Vector similarity is candidate generation only. BabyLoop Assistant must first classify safety/domain, resolve the canonical answer owner, then retrieve with owner/topic/source-path constraints.

Critical health-like domains fail closed:

- canonical owner missing => no-source
- forbidden topic candidate => reject
- cross-domain high-vector candidate => reject
- no generic LLM fallback

For feeding queries, `feeding-and-food-safety-canon` is required and product, toy, listing, seasonal-needs and marketplace usage sources are not valid evidence.

# BabyLoop RAG kaynak politikası

BabyLoop RAG kaynakları asistanın yalnızca güvenli alışveriş, ilan hazırlama, ürün kontrol listeleri, yaş dönemine göre genel ihtiyaçlar ve BabyLoop kullanımı hakkında kısa yanıt üretmesi için kullanılır. Kaynak yoksa asistan cevap uydurmaz.

## Kaynak türleri

- Internal policy: BabyLoop sınırları, gizlilik ve cevaplama kuralları.
- Internal: BabyLoop kullanım rehberi, mesajlaşma, ilan yazımı ve platform davranışı.
- Editorial checklist: Ürün seçimi için editoryal kontrol listeleri.
- Official safety source: Resmi ürün güvenliği uyarıları, üretici duyuruları veya kamu güvenliği kaynakları.

## Source reliability

Her RAG dokümanı `sourceReliability` metadata alanı taşır. `internal-policy` sınır ve güvenlik politikasını, `internal` BabyLoop ürün bilgisini, `editorial` kaynaklı ama kesin garanti vermeyen kontrol listelerini, `official-source-note` resmi kaynak kategorisi notlarını, `official-referenced` ise ileride doğrulanmış resmi kaynak referansı eklenmiş dokümanları temsil eder.

## Cevaplanacak konular

Asistan BabyLoop kullanımı, güvenli mesajlaşma, ilan yazımı, fotoğraf kalitesi, ikinci el ürün kontrol soruları ve yaş dönemine göre genel ürün hazırlığı konularını cevaplayabilir. Yanıt kısa olmalı ve kaynaklarda olmayan bilgi eklenmemelidir.

## Cevaplanmayacak konular

Asistan tıbbi tanı, ilaç, tedavi, terapi, diyet planı veya acil sağlık yönlendirmesi vermez. Doktor veya uzman yerine geçmez. Sağlık belirtisi anlatılsa bile yanıt sınır koymalı ve kullanıcıyı uygun uzmana yönlendirmelidir.

## İkinci el ürün güvenliği

İkinci el ürünlerde kesin güvenlik garantisi verilmez. Özellikle oto koltuğu, beşik, uyku ürünü, taşıyıcı ve oyuncaklarda model, seri, üretici bilgisi ve geri çağırma uyarıları kontrol edilmelidir. Kaynak yetersizse “yeterli kaynak yok” denmelidir.
