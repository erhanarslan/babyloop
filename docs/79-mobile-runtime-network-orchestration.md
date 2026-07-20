# Mobile Runtime Network Orchestration

## Amaç

Bu çalışma mobil uygulamadaki görünürlükten bağımsız polling, yinelenen auth/conversation istekleri ve analytics event başına gönderim davranışını production sınırlarına taşır.

## Kapatılan riskler

- Güvenlik ekranındaki 4 saniyelik session polling kaldırıldı.
- Güvenlik verileri yalnızca ekran focus olduğunda ve uygulama foreground'a döndüğünde yenilenir.
- Pending ilan publication kontrolü yalnızca ekran focus + foreground durumunda, 7/12/20/30 saniyelik bounded backoff ile çalışır.
- Conversation listesi, tab badge ve Mesajlar ekranı için tek provider/store altında tutulur.
- Conversation fetch ve realtime subscription çoğaltılması kaldırıldı.
- Mobil auth refresh çağrıları shared in-flight promise ile tekilleştirildi.
- Login/register/MFA başarı cevabından sonra gereksiz `/auth/me` round-trip kaldırıldı.
- Analytics eventleri SecureStore kuyruğunda serialize edilir; event başına flush yerine 10 event veya 10 saniye eşiği kullanılır.
- Analytics flush bütün 50'lik batch'leri FIFO sırasıyla tüketir ve concurrent queue mutation sırasında event kaybetmez.
- Push registration 24 sabit deneme yerine 8 bounded deneme, 5/15/30/60 saniye backoff ve profile-scoped 24 saatlik başarı cache'i kullanır.

## Korunan davranışlar

- App background olduğunda analytics engagement kaydı flush edilir.
- Realtime conversation update tab badge ve Mesajlar ekranına aynı state üzerinden yansır.
- Push permission denied ve fiziksel cihaz/FCM konfigürasyon hataları retry döngüsünü durdurur.
- Draft-only/provider güvenlik sınırları ve login approval push davranışı değişmez.

## Release kapısı

`pnpm security:mobile-runtime-performance` statik runtime sınırlarını doğrular ve `pnpm release:mobile:p0` içine dahildir.

Hedefli testler:

- `src/features/auth/auth-api.test.ts`
- `src/features/analytics/analytics-client.test.ts`
- `src/features/listings/my-listings-runtime-model.test.ts`
- `src/features/notifications/mobile-push-registration-policy.test.ts`
- mevcut messaging realtime ve push registration testleri

## Sonraki mobil performans paketi

Bu çalışma request orchestration P0'ını kapatır. Aşağıdaki işler ayrı P1 paketidir:

- Browse `FlatList`/virtualization ve pagination
- listing detail `viewerState` ile favorite/cart overfetch kaldırılması
- notifications list + unread count aggregate response
- child dashboard aggregate/cache stratejisi
- Galaxy S22 gerçek cihaz profiler ve keyboard/composer regresyonu
