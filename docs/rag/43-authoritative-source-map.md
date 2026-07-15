---
id: authoritative-source-map
title: Authoritative Source Map for BabyLoop RAG
locale: tr
topic: rag-source-policy
safetyScope: rag-governance
sourceReliability: official-referenced
version: 2026-07-15
---

# Authoritative Source Map for BabyLoop RAG

Bu doküman BabyLoop RAG corpus'unun resmi/otoriter kaynak kayıt defteridir.

BabyLoop RAG cevapları şu hiyerarşiye göre kaynak kullanır:

1. Resmi kamu/kurum rehberleri.
2. Uzman dernek/akademi rehberleri.
3. BabyLoop internal policy ve marketplace dokümanları.
4. Editorial checklistler.

## Kaynak güvenilirliği sınıfları

### official-referenced

Resmi veya uzman kurumdan alınan bilgi BabyLoop diliyle yeniden yazılır. Cevap klinik karar yerine geçmez.

Kullanım alanları:

- tamamlayıcı beslenme başlangıç yaşı
- boğulma riski
- bal, tuz, şeker gibi kaçınılacak gıdalar
- güvenli uyku
- oto koltuğu ikinci el checklist
- geri çağırma kontrolü
- ateş/kırmızı bayrak boundary

### official-source-note

Kaynak linki, veri tabanı veya kontrol adresi olarak anılır. BabyLoop kullanıcıya "kontrol et" aksiyonu verir.

Kullanım alanları:

- CPSC recall kontrolü
- NHTSA used car seat checklist
- üretici model/seri numarası kontrolü
- ürün etiketi, model, üretim tarihi kontrolü

### internal-policy

BabyLoop davranış sınırını belirler.

Kullanım alanları:

- no diagnosis
- no medication/dosage
- no diet prescription
- no therapy
- no product safety guarantee
- no payment guarantee
- no off-platform contact encouragement

### editorial

BabyLoop ürün ve alışveriş checklistlerini sadeleştirir. Resmi kaynak gerektiren iddialar bu dokümanda tek başına yapılmaz.

## Araştırma kaynakları ve BabyLoop kullanım notu

### CDC — Infant and Toddler Nutrition

Kapsam:

- yaklaşık 6 ayda katı gıdaya başlama
- 4 aydan önce katı gıda önerilmemesi
- boğulma riski ve yiyecek hazırlama
- balın 12 aydan önce verilmemesi
- developmental readiness işaretleri

BabyLoop kullanımı:

- "Ek gıdaya ne zaman başlanır?"
- "6 aylık bebek ne yer?"
- "Boğulma riski olan yiyecekler neler?"
- "Bebeğe bal verilir mi?"

Boundary:

- kişisel menü, alerji yönetimi, hastalıkta beslenme ve tedavi amaçlı diyet yoktur.

### WHO — Infant and Young Child Feeding / Complementary Feeding

Kapsam:

- 6–23 ay tamamlayıcı beslenme dönemi
- anne sütü ile birlikte tamamlayıcı besinler
- öğün sıklığına genel yaklaşım
- global normatif rehber

BabyLoop kullanımı:

- "6-8 ay kaç öğün?"
- "9-11 ay kaç öğün?"
- "12-24 ay nasıl beslenir?"

Boundary:

- WHO global rehberdir; yerel klinik karar ve bireysel beslenme planı yerine geçmez.

### Türkiye Halk Sağlığı Genel Müdürlüğü — Bebek Beslenmesi

Kapsam:

- ilk 6 ay sadece anne sütü vurgusu
- tamamlayıcı besinlere geçiş
- yeni gıdaların tek tek denenmesi
- 6-8 ay, 9-11 ay, 12-24 ay broşürleri

BabyLoop kullanımı:

- Türkçe RAG cevaplarında yerel bağlam için tercih edilir.
- "Ek gıdaya nasıl başlanır?"
- "3 gün kuralı nedir?"
- "Hangi dönem hangi kıvam?"

Boundary:

- resmi broşürler genel halk sağlığı bilgilendirmesidir; doktor/diyetisyen değerlendirmesi yerine geçmez.

### NHS — Baby, Fever, Teething, Weaning

Kapsam:

- ilk katı gıdalar ve texture progression
- ateşli çocukta genel gözlem ve sıvı
- teething belirtileri
- ciddi belirti durumunda sağlık desteği

BabyLoop kullanımı:

- "Diş çıkarıyor mu hasta mı?"
- "Ateşi var ne yapayım?"
- "Püre mi pütürlü mü?"
- "Ne zaman doktora?"

Boundary:

- BabyLoop ilaç seçimi/doz vermez. NHS sayfaları ilaç ismi içerse bile BabyLoop cevabı "ambalaj/profesyonel danışma" sınırını aşmaz.

### AAP / HealthyChildren — Safe Sleep, Feeding, Teething

Kapsam:

- güvenli uyku
- ilk aylar sık sorulan sorular
- teething pain relief ve doktoru arama işaretleri
- bebek beslenme sıklığı

BabyLoop kullanımı:

- "Bebek nerede uyumalı?"
- "Reflüde eğimli uyku olur mu?"
- "Diş çıkarma ateş yapar mı?"
- "Yeni doğan ne sıklıkla beslenir?"

Boundary:

- klinik karar, teşhis veya tedavi planı verilmez.

### AAP Safe Sleep / NIH Safe to Sleep

Kapsam:

- sırtüstü uyku
- kendi uyku alanı
- sert/düz yüzey
- yumuşak nesne yok
- oturma cihazında uyku önerilmemesi

BabyLoop kullanımı:

- "Beşik alırken neye bakılır?"
- "Ana kucağında uyusun mu?"
- "Park yatakta uyku güvenli mi?"
- "Yastık/battaniye/bumper kullanılır mı?"

### NHTSA — Used Car Seat Safety Checklist

Kapsam:

- kaza geçmişi
- üretim tarihi/model etiketi
- recall kontrolü
- eksik parça
- kullanım kılavuzu
- seat expiration / manufacturer instruction

BabyLoop kullanımı:

- "Oto koltuğu ikinci el alınır mı?"
- "Kaza geçmişi bilinmeyen oto koltuğu alınır mı?"
- "Üretim tarihi neden önemli?"
- "Oto koltuğu kesin güvenli mi?"

Boundary:

- BabyLoop hiçbir ikinci el oto koltuğunu "kesin güvenli" ilan etmez.

### CPSC — Recalls and Baby Safety Checklist

Kapsam:

- ürün geri çağırma kontrolü
- beşik, uyku alanı, high chair, durable infant/toddler products
- model/üretici/etiket bilgileri
- ürün güvenliği uyarıları

BabyLoop kullanımı:

- "Geri çağırma kontrolü nasıl yapılır?"
- "İkinci el beşik alınır mı?"
- "Mama sandalyesi güvenli mi?"
- "Etiket/model yoksa alınır mı?"

## Kullanılmayacak kaynaklar

Aşağıdaki kaynaklar BabyLoop RAG için doğrudan answer source olamaz:

- forum yorumları
- sosyal medya gönderileri
- influencer önerileri
- satıcı ilan metinleri
- ürün reklam sayfaları
- affiliate listeleri
- "en iyi ürün" listeleri
- doğrulanmamış bloglar
- bireysel sağlık tavsiyesi veren içerikler

Bunlar yalnızca soru varyasyonu keşfi için kullanılabilir; cevap içeriği için kullanılmaz.

## Cevaplarda kaynak atıf disiplini

Her canonical answer doc şunu belirtir:

- Bu cevap hangi kaynak ailesine dayanır?
- Hangi soru ailelerini cevaplar?
- Hangi sınırı aşmaz?
- Hangi durumda boundary/no-source döner?
- Hangi doküman bu cevabın owner'ıdır?

Cevaplar kısa ve pratik olmalı; RAG içeriği gereksiz klinik detayla şişirilmemelidir.

## Türkiye public-health authority note

Türkiye HSGM, BabyLoop RAG kaynak haritasında Türkiye bağlamı için resmi/otoriter halk sağlığı kaynağı olarak değerlendirilir. Bu kaynak sınıfı; forum, influencer, reklam, satıcı ilanı veya blog içerikleriyle eşdeğer kabul edilemez.

Kullanım kuralı:
- Türkiye HSGM yalnızca resmi halk sağlığı bilgilendirmesi için authority-first kaynak sınıfına girer.
- Kaynak metinde açık destek yoksa BabyLoop cevap üretmez; `insufficient_sources` veya güvenlik sınırı gerekiyorsa `blocked_safety` döner.
- Bu kaynak sınıfı tanı, tedavi, ilaç/doz, acil durum yönlendirmesi veya kişiye özel tıbbi karar üretmek için kullanılmaz.
