---
id: parent-question-inventory-dedup-map
title: Parent Question Inventory and Dedup Map
locale: tr
topic: parent-question-inventory
safetyScope: rag-governance
sourceReliability: internal-policy
version: 2026-07-15
---

# Parent Question Inventory and Dedup Map

Bu doküman BabyLoop RAG corpus'unun soru envanteri ve tekilleştirme katmanıdır.

Amaç internetten bulunan her soruya ayrı ayrı cevap yazmak değildir. Amaç:

1. Ebeveynlerin aynı niyeti farklı kelimelerle sorduğu soruları tekilleştirmek.
2. Her soru ailesini tek bir canonical answer owner dokümanına bağlamak.
3. Aynı cevabın birden fazla dokümanda dağılmasını engellemek.
4. RAG retrieval sırasında doğru doküman konusunu öne çıkarmak.
5. Sağlık, ilaç, tedavi, diyet, alerji, acil durum ve tanı sorularında BabyLoop sınırını korumak.

## Soru tekilleştirme ilkesi

Bir soru aşağıdaki sinyallerden en az ikisini paylaşıyorsa aynı canonical soru ailesine girer:

- aynı ebeveyn niyeti
- aynı yaş bandı
- aynı ürün veya bakım alanı
- aynı güvenlik riski
- aynı cevap owner dokümanı
- aynı boundary seviyesi

Runtime routing bu envanteri yalnız açıklayıcı doküman olarak değil, owner-first retrieval sinyali olarak kullanır. Yaş veya cinsiyet sinyali tek başına "yaşa göre ürün ihtiyacı" ailesine taşımaz; örneğin "6 aylık erkek bebeğe ek gıda ne yedirilir?" sorusu feeding owner'a gider ve oyuncak/ürün ailesi adayları hard-filter ile düşürülür.

Örnek:

- "6 aylık bebek ne yer?"
- "6 aylık bebeğe ek gıda ne vereyim?"
- "Ek gıdaya neyle başlamalıyım?"
- "Bebeğim 6 aylık oldu, menü yazar mısın?"

Bu sorular aynı değildir. İlk üçü genel tamamlayıcı beslenme bilgisi ve güvenli sınırla cevaplanabilir. "Menü yazar mısın?" ise diyet reçetesi/kişiselleştirilmiş beslenme riskine yaklaşır ve daha sınırlı cevaplanmalıdır.

## Canonical soru aileleri

### A. BabyLoop marketplace ve güvenli alışveriş

Owner dokümanlar:

- `01-babyloop-marketplace-guide.md`
- `02-safe-shopping-guide.md`
- `06-messaging-and-privacy.md`
- `19-marketplace-dispute-and-reporting-guide.md`
- `47-second-hand-product-safety-canon.md`

Canonical sorular:

1. BabyLoop nasıl kullanılır?
2. İkinci el bebek ürünü alırken genel olarak neye bakmalıyım?
3. Satıcıya ürünü almadan önce ne sormalıyım?
4. Satıcı hemen IBAN istedi, ne yapmalıyım?
5. Ürünü görmeden ödeme yapmak güvenli mi?
6. Teslimatta nelere dikkat etmeliyim?
7. Satıcı yanlış ürün gönderdi, ne yapmalıyım?
8. Ürün görseldeki gibi çıkmadı, ne yapmalıyım?
9. Bir ilanı nasıl raporlarım?
10. Bir kullanıcıyı nasıl engellerim?
11. Satıcı telefon istedi, paylaşmalı mıyım?
12. Adresimi mesajda yazmalı mıyım?
13. Kargo mu elden teslim mi daha güvenli?
14. Ürünü almadan önce video/fotoğraf istemeli miyim?
15. Ürün faturası/garantisi yoksa ne yapmalıyım?

### B. İlan yazımı ve satıcı tarafı

Owner dokümanlar:

- `03-listing-writing-guide.md`
- `13-seller-photo-quality-guide.md`
- `14-buyer-question-templates.md`

Canonical sorular:

1. İlan açıklaması nasıl yazılır?
2. Bebek arabası ilanına hangi bilgileri yazmalıyım?
3. Oto koltuğu ilanında hangi bilgileri belirtmeliyim?
4. Mama sandalyesi ilanında hangi eksikleri söylemeliyim?
5. Kıyafet ilanında beden/ölçü nasıl yazılır?
6. Ürünün kusurunu nasıl anlatmalıyım?
7. Fotoğrafları nasıl çekmeliyim?
8. Çocuğumun yüzü fotoğrafta görünmeli mi?
9. Ürünün güvenli olduğunu yazabilir miyim?
10. Sertifika/standart iddiası nasıl yazılmalı?
11. Fiyat önerisi güvenilir mi?
12. Eksik parça varsa ilan yayınlanabilir mi?
13. Ürünün temizliğini nasıl belirtmeliyim?
14. Satıldı/rezerve/arşiv durumları ne anlama gelir?

### C. Bebek arabası, puset, travel system

Owner dokümanlar:

- `07-stroller-buying-checklist.md`
- `47-second-hand-product-safety-canon.md`

Canonical sorular:

1. Bebek arabası alırken nelere bakmalıyım?
2. Puset ikinci el alınır mı?
3. Travel system alırken neye dikkat edilir?
4. Fren sistemi nasıl kontrol edilir?
5. Tekerlek, katlanma mekanizması ve iskelet nasıl kontrol edilir?
6. Kumaş ve emniyet kemeri yıpranması önemli mi?
7. Bebek arabasında eksik parça riskli mi?
8. Bebek arabası için geri çağırma kontrolü gerekir mi?
9. Yenidoğan için hangi puset tipi uygundur?
10. Bebek arabası ile oto koltuğu birlikte satılıyorsa ne sorulmalı?

### D. Oto koltuğu ve araç güvenliği

Owner dokümanlar:

- `08-car-seat-second-hand-checklist.md`
- `47-second-hand-product-safety-canon.md`

Canonical sorular:

1. Oto koltuğu ikinci el alınır mı?
2. Oto koltuğu kesin güvenli mi?
3. Kaza geçmişi bilinmeyen oto koltuğu alınır mı?
4. Üretim tarihi ve model etiketi neden önemli?
5. Oto koltuğu geri çağırma kontrolü nasıl yapılır?
6. Eksik parça/kılavuz yoksa ne yapılır?
7. Oto koltuğu son kullanma tarihi olur mu?
8. Oto koltuğu temiz görünüyorsa yeterli mi?
9. Bebek kaç yaşına kadar arkaya dönük oturmalı?
10. Ana kucağı ile oto koltuğu aynı şey mi?

### E. Uyku ürünleri, beşik, park yatak, yatak

Owner dokümanlar:

- `11-crib-and-sleep-product-boundaries.md`
- `45-safe-sleep-and-product-boundary-canon.md`

Canonical sorular:

1. İkinci el beşik alınır mı?
2. Beşik alırken nelere bakılır?
3. Park yatak güvenli mi?
4. Bebek hangi yüzeyde uyumalı?
5. Yatak sertliği neden önemli?
6. Yastık, battaniye, bumper kullanılmalı mı?
7. Reflüsü olan bebek eğimli yatakta uyutulur mu?
8. Ana kucağında uyuması güvenli mi?
9. Sallanan beşik / otomatik salıncak uyku için kullanılabilir mi?
10. İkinci el yatak alınır mı?
11. Uyku tulumu güvenli mi?
12. Weighted blanket / ağırlıklı battaniye kullanılabilir mi?

### F. Oyuncak güvenliği

Owner dokümanlar:

- `09-toy-safety-checklist.md`
- `47-second-hand-product-safety-canon.md`

Canonical sorular:

1. Oyuncakta küçük parça riski nedir?
2. Hangi oyuncaklar boğulma riski taşır?
3. Manyetik oyuncaklar riskli mi?
4. Pilli oyuncaklarda neye bakılır?
5. İkinci el pelüş oyuncak alınır mı?
6. Oyuncak yaşı etiketi neden önemli?
7. Oyuncakta kırık/çatlak varsa ne yapılır?
8. Boya/koku/plastik kalitesi nasıl değerlendirilir?
9. Oyuncak geri çağırma kontrolü gerekir mi?
10. Montessori oyuncak diye satılan ürün güvenli midir?

### G. Tekstil, hijyen ve bakım ürünleri

Owner dokümanlar:

- `10-baby-textile-and-hygiene-checklist.md`
- `47-second-hand-product-safety-canon.md`

Canonical sorular:

1. İkinci el bebek kıyafeti alınır mı?
2. Bebek kıyafeti alırken hangi kumaşlara dikkat edilmeli?
3. Ayakkabı ikinci el alınır mı?
4. Beden seçimi nasıl yapılır?
5. Tekstil ürünleri nasıl yıkanmalı?
6. Leke/koku/alerjen iddiası nasıl değerlendirilmeli?
7. Biberon/emzik ikinci el alınır mı?
8. Steril ürünler ikinci el alınır mı?
9. Bebek bakım seti alırken neye bakılır?
10. Banyo küveti/oturağı ikinci el alınır mı?

### H. Yaşa göre ürün ihtiyacı

Owner dokümanlar:

- `05-age-based-product-needs.md`
- `21-pregnancy-preparation-and-marketplace-needs.md`
- `22-newborn-0-3-months-everyday-needs.md`
- `23-infant-3-12-months-product-and-safety-needs.md`
- `24-toddler-12-36-months-product-and-home-safety.md`
- `25-preschool-3-5-years-product-learning-and-safety.md`
- `26-child-5-7-years-school-play-dental-and-product-needs.md`
- `29-age-season-product-recommendation-matrix.md`

Canonical sorular:

1. Hamileyken hangi ürünleri ne zaman hazırlamalıyım?
2. Yenidoğan için neler gerekir?
3. 0-3 ay bebek için hangi ürünler işe yarar?
4. 3-6 ay bebek için hangi ürünler gerekir?
5. 6 aylık bebek için hangi ürünler gerekir?
6. 9 aylık bebek için hangi ürünler gerekir?
7. 12 aylık çocuk için hangi ürünler gerekir?
8. 18 aylık çocuk için ne almalı?
9. 2 yaş çocuk için hangi ürünler gerekir?
10. 3 yaş çocuk için hangi ürünler gerekir?
11. Kışın 2 yaş çocuk için ne lazım?
12. Yazın bebek için hangi ürünler gerekir?
13. Çocuk büyüdükçe hangi ürünleri satabilirim?
14. Hangi ürünleri erken almak mantıksız?
15. Hangi ürünler kısa süre kullanılır?

### I. Tamamlayıcı beslenme, ek gıda, gıda güvenliği

Owner doküman:

- `44-feeding-and-food-safety-canon.md`

Canonical sorular:

1. Ek gıdaya ne zaman başlanır?
2. 6 aylık bebek ne yer?
3. 6 aylık bebeğe hangi yiyecek verilir?
4. Ek gıdaya hangi gıdayla başlanır?
5. İlk ek gıda yoğurt mu sebze mi meyve mi?
6. Her gıdayı kaç gün denemeliyim?
7. Püre mi BLW mi?
8. Bebek parmak gıda yiyebilir mi?
9. Bebeğe bal verilir mi?
10. Bebeğe inek sütü verilir mi?
11. Bebeklere tuz/şeker verilir mi?
12. Boğulma riski olan yiyecekler neler?
13. Üzüm, fındık, havuç nasıl verilir?
14. Bebek su içer mi?
15. 6-8 ay kaç öğün yemeli?
16. 9-11 ay kaç öğün yemeli?
17. 12-24 ay nasıl beslenir?
18. Alerji yapar mı?
19. Alerjik reaksiyon olursa ne yapmalı?
20. Bana menü yazar mısın?
21. Kilo almıyor, ne yedireyim?
22. Demir eksikliği için ne yedirmeli?
23. Kabızlık için ne yedirmeli?
24. İshalde ne yedirmeli?

Boundary notu:

- Genel tamamlayıcı beslenme bilgisi verilebilir.
- Kişiselleştirilmiş diyet, tedavi amaçlı menü, alerji yönetimi, kilo problemi, hastalıkta beslenme ve takviye önerileri boundary'dir.
- Bebek özelinde beslenme kararı çocuk doktoru/aile hekimi/diyetisyen değerlendirmesine yönlendirilmelidir.

### J. Ateş, hastalık belirtileri, kırmızı bayraklar

Owner doküman:

- `46-illness-red-flags-boundary-canon.md`

Canonical sorular:

1. Ateşi var ne yapayım?
2. Bebek ateşinde ne zaman doktora gidilir?
3. Hangi ilacı vereyim?
4. Kaç ml ateş düşürücü verilir?
5. Öksürüyor ne yapayım?
6. Burnu tıkalı ne yapayım?
7. İshal oldu ne yapmalıyım?
8. Kusuyor ne yapmalıyım?
9. Diş çıkarıyor mu hasta mı?
10. Diş çıkarma ateş yapar mı?
11. Çok ağlıyor normal mi?
12. Uyku düzeni bozuldu, hastalık mı?
13. Döküntü çıktı ne yapmalıyım?
14. Alerji olabilir mi?
15. Nefesi hızlı, ne yapmalıyım?
16. Susuz kaldığını nasıl anlarım?
17. Acile ne zaman gitmeliyim?

Boundary notu:

- BabyLoop tanı koymaz.
- İlaç, doz, tedavi planı, hastalık yönetimi önermez.
- Red-flag belirtilerde sağlık kuruluşuna yönlendirir.
- Genel konfor ve gözlem bilgisi kaynaklı ve sınırlı olmalıdır.

### K. Gelişim, diş, uyku rutini

Owner dokümanlar:

- `27-primary-and-permanent-teeth-eruption-timeline.md`
- `34-newborn-care-everyday-non-medical-guide.md`
- `38-teething-care-and-dental-red-flags.md`
- `45-safe-sleep-and-product-boundary-canon.md`

Canonical sorular:

1. Bebeğim ne zaman döner?
2. Ne zaman emekler?
3. Ne zaman yürür?
4. Ne zaman konuşur?
5. 2 yaş gelişiminde nelere bakılır?
6. Gelişimi geride mi?
7. Diş ne zaman çıkar?
8. Diş çıkarma belirtileri neler?
9. Diş çıkarma ateş/ishal yapar mı?
10. Diş fırçalama ne zaman başlar?
11. Uyku rutini nasıl kurulur?
12. Gece uyanması normal mi?
13. Uyku eğitimi verelim mi?
14. Bebek çok ağlıyor, ne yapmalıyım?

Boundary notu:

- Gelişim milestone bilgisi genel farkındalık içindir.
- Gecikme, regresyon, nörolojik belirti, beslenme/uyku krizi gibi durumlarda sağlık uzmanı yönlendirmesi yapılır.

## Çakışan soru yönetimi

Aynı soru birden fazla dokümana dokunuyorsa cevap şu sırayla seçilir:

1. **Boundary owner**: İlaç, tanı, tedavi, acil durum, diyet, alerji.
2. **Official referenced canon**: Beslenme, uyku, ürün güvenliği, oto koltuğu.
3. **Marketplace owner**: Alım/satım, mesajlaşma, rapor, iade/anlaşmazlık.
4. **Editorial guide**: Yaşa göre ürün ihtiyaçları, sezonluk hazırlık, checklist.
5. **No-source fallback**: Kaynak yoksa cevap uydurulmaz.

Örnek:

- "6 aylık bebek için ne almalıyım?" -> age-based product needs.
- "6 aylık bebek ne yemeli?" -> feeding canon.
- "6 aylık bebeğe kilo aldıran menü yaz" -> feeding boundary + healthcare referral.
- "Oto koltuğu ikinci el alınır mı?" -> car seat checklist + product safety canon.
- "Oto koltuğu kesin güvenli mi?" -> car seat checklist + no absolute safety language.
