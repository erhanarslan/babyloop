# Legal, KVKK, Consent & Public Trust

Bu paket BabyLoop'un teknik ürün davranışı ile kullanıcıya gösterilen yasal/güven yüzeyini aynı sözleşmeye bağlar. Metinler ürünün mevcut beta davranışını açıklar; şirketleşme, gerçek ödeme, yurt dışı aktarım veya sağlayıcı değişikliği öncesinde Türkiye'de yetkili bir hukuk uzmanı tarafından nihai inceleme zorunludur.

## Temel ilkeler

- KVKK aydınlatması bir bilgilendirme yükümlülüğüdür; kullanım koşullarının kabulü veya açık rıza ile birleştirilmez. Uygulamada **aydınlatma ve açık rıza ayrımı** korunur.
- Kayıt için yalnızca güncel Kullanım Koşulları sürümünün ayrı kabulü zorunludur.
- Zorunlu olmayan web ürün analitiği ayrı bir tercih yüzeyindedir; **opsiyonel analitik varsayılan kapalı** başlar.
- "Reddet" ve "İzin ver" seçenekleri aynı yüzeyde görünür. Reddetme halinde anonim kimlik ve session analytics kaydı temizlenir.
- Çocuk profili çocukların doğrudan kullanımına yönelik değildir; ebeveyn/yasal temsilci tarafından yönetilir.
- Yapay zekâ yanıtları tanı, tedavi, ilaç veya kişisel sağlık hizmeti değildir.
- Şirket/ödeme sağlayıcısı etkin değilken checkout simülasyondur ve gerçek para tahsil edilmez.

## Sürümlü belgeler

Tek kaynak `packages/shared/src/legal.ts` içindeki `LEGAL_DOCUMENT_VERSIONS` kaydıdır. Web ve mobil aynı sürümü gösterir; API yalnızca `CURRENT_TERMS_VERSION` kabul eder.

Public rotalar:

- `/legal/privacy`
- `/legal/kvkk`
- `/legal/terms`
- `/legal/cookies`
- `/legal/ai-notice`
- `/legal/marketplace`
- `/legal/data-deletion`
- `/support/contact`

## Kayıt ve kabul kanıtı

`packages/database/drizzle/0044_legal_public_trust.sql` migration'ı `legal_acceptances` tablosunu oluşturur. Her kabul kaydı şu kanıtları içerir:

- kullanıcı kimliği,
- belge türü,
- belge sürümü,
- kabul kaynağı (`web_password`, `mobile_password`, `google_oauth`),
- kabul zamanı.

Password registration, şartlar kabul edilmeden API schema seviyesinde reddedilir. Google OAuth'ta yeni hesap oluşturulurken kabul, OAuth state ile bağlı kısa ömürlü httpOnly cookie üzerinden taşınır. Var olan Google veya password hesabına giriş için geçmişe dönük zorunlu re-consent uygulanmaz.

## KVKK aydınlatma alanı

Aydınlatma metni veri sorumlusu kimliği, işleme amaçları, toplama yöntemi ve hukuki sebepler, alıcı grupları/aktarım ve KVKK madde 11 hakları için ayrı bölümler sunar. Production ortamında gerçek işletmeci bilgileri şu değişkenlerle zorunludur:

- `NEXT_PUBLIC_LEGAL_OPERATOR_NAME`
- `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`
- `NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS`
- `EXPO_PUBLIC_WEB_BASE_URL`

`pnpm deploy:check:staging` ve `pnpm deploy:check:production` placeholder veya local değerleri reddeder.

## Analitik consent sınırı

Web analytics provider yalnızca stored preference `accepted` olduğunda initialize olur. `unset` ve `rejected` durumlarında event/session oluşturulmaz; mevcut `babyloop.analytics.anonymousId` ve `babyloop.analytics.session` kayıtları temizlenir. Mesaj, şifre ve çocuk notları analytics payload'ına alınmaz.

## Doğrulama

```bash
pnpm security:legal-public-trust
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm test:api:legal
pnpm test:web:legal
pnpm test:mobile:legal
```

Migration testte ve lokal development ortamında standart migrator ile uygulanır. Production migration, staging kanıtı, backup ve release go/no-go sonrasında çalıştırılır.


## Non-commercial beta operator posture

BabyLoop may be released with `NEXT_PUBLIC_LEGAL_RELEASE_MODE=non_commercial_beta`
while `NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED=false`.

In this posture:

- the real natural-person data-controller/operator identity and a public contact
  email remain mandatory;
- `NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION` publishes only a city/country-level
  location;
- a residence or full postal address is not forced into the public UI;
- real payment collection and commercial public launch remain disabled;
- `NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS` becomes mandatory before switching to
  `commercial_public`.

This gate is an operational fail-closed boundary, not a substitute for review
by a qualified Turkish privacy/e-commerce lawyer before commercial launch.
