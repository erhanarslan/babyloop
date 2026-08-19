# BabyLoop LinkedIn görselleri

Bu otomasyon Android development/marketing build ekranlarını yakalar ve 1080 × 1350 mobil carousel görselleri üretir. Nihai carousel'e eklenecek backoffice ekranları güvenlik nedeniyle ayrı, manuel/local girdilerdir.

## Gereksinimler

- USB debugging açık, kilidi kaldırılmış bir Android telefon
- `adb`, [Maestro](https://maestro.mobile.dev/) ve proje bağımlılıkları
- Cihazda kurulu BabyLoop development/marketing build
- `http://127.0.0.1:4000` üzerinde çalışan local API
- Kök `.env.local` içinde yalnız local/test PostgreSQL `DATABASE_URL`
- Local/demo seed ile eşleşen, gerçek kullanıcıya ait olmayan `BABYLOOP_MARKETING_DEMO_EMAIL` ve `BABYLOOP_MARKETING_DEMO_PASSWORD`
- RAG ekranı için `docs/rag/08-car-seat-second-hand-checklist.md` kaynağını içeren local/demo seed

Birden fazla cihaz bağlıysa `ANDROID_SERIAL` ile cihazı seç. Farklı local API portu için örneğin `MARKETING_API_URL=http://127.0.0.1:4100` kullanabilirsin. Otomasyon remote API veya veritabanı hedefini reddeder.

## Çalıştırma

Demo credential'larını shell ortamında tanımladıktan sonra repo kökünden çalıştır:

```bash
BABYLOOP_ANDROID_PACKAGE=com.babyloop.mobile.marketing \
pnpm marketing:mobile-screenshots
```

Kurulu build'in package adı `com.babyloop.mobile` ise `BABYLOOP_ANDROID_PACKAGE` gerekli değildir. `04-ai-link-import`, uygulamada URL import rotası bulunmadığı için fotoğraf ve form tabanlı ilan başlangıcını gösterir. RAG akışı yalnız kaynaklı yanıt ile görünür kaynak kartı oluşursa tamamlanır; kaynak yokken üretilen bir yanıtı pazarlama görseli olarak kabul etmez.

## Output ve final carousel

- `artifacts/linkedin/mobile/raw/`: cihazdan alınan ham mobil PNG'ler
- `artifacts/linkedin/mobile/carousel/`: compose edilmiş mobil PNG'ler
- `artifacts/linkedin/final-carousel/`: paylaşılacak nihai carousel

Bu klasörlerin tamamı generated ve gitignored'dur.
Her mobil capture çalışması önce önceki ham/mobil carousel PNG'lerini temizler; saklamak istediğin çıktıları çalıştırmadan önce başka bir local klasöre kopyala.

`compose.mjs` yalnız mobil ham görüntüleri mobil carousel'e dönüştürür. `compose-final.mjs`, mobil seti iki backoffice girdisiyle birleştirir. Final composer'ı çalıştırmadan önce aşağıdaki ham görüntüleri `artifacts/linkedin/backoffice/raw/` altında manuel olarak hazırla:

- `07-backoffice-dashboard.png`
- `08-backoffice-analytics.png`

Bu görüntüler yalnız local/demo ortamındaki sentetik admin rolüyle, salt-okunur ekranlardan alınmalıdır. Otomasyon production admin hesabına giriş yapmaz ve gerçek admin credential'ı saklamaz. Girdiler hazır olduğunda:

```bash
node scripts/marketing/mobile-linkedin/compose-final.mjs
```

## Güvenlik kontrolü

LinkedIn'e yüklemeden önce her çıktıyı manuel incele. E-posta, telefon, adres, token, cookie, session, kişisel bildirim veya gerçek kullanıcı verisi görünüyorsa paylaşma. Cihaz durum çubuğunu ve backoffice ekranlarındaki tablo, grafik ve tooltip'leri de kontrol et.
