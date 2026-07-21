# Release candidate staging acceptance and production GO/NO-GO

Bu sözleşme, kodun testten geçmesini gerçek staging kanıtından ayırır. Production promotion yalnızca aynı Git SHA için güncel, checksum korumalı ve birbirini tamamlayan dört kanıt mevcutsa açılır.

## Neyi kapatır?

- Deployment sonrası yalnızca `/health` kontrol edilmesi yerine gerçek public yüzeylerin doğrulanması
- Staging performansının ölçülmeden production kararı verilmesi
- Galaxy S22 ve gerçek sağlayıcı kontrollerinin sözlü olarak geçilmiş sayılması
- Restore-smoke çıktısının dosya bütünlüğü olmadan kullanılması
- Eski veya başka commit'e ait kanıtlarla production promotion yapılması
- Production migration başlamadan önce GO/NO-GO kanıtının doğrulanmaması

## Staging acceptance

`pnpm deploy:acceptance`, deployment env dosyasını yükler ve şu yüzeyleri ölçer:

- API liveness ve readiness
- Kategori referans verisi ve cache sözleşmesi
- 20 kayıtlık public listing summary çağrısı (`imageLimit=1`, `includeTotal=false`)
- Web ana sayfa ve browse
- Backoffice giriş yüzeyi
- Privacy, KVKK, terms, cookie, AI notice, marketplace, data deletion ve support sayfaları
- Yetkili metrics endpoint'i

Ana endpoint'ler birden fazla kez örneklenir. Kanıt dosyasında p50, p95, maksimum süre, response byte büyüklüğü, status kodları ve güvenlik/cache header özeti tutulur. Production'da performans eşikleri zorunlu olarak uygulanır; staging'de eşik aşımı kanıta warning olarak yazılabilir.

Örnek:

```bash
DEPLOY_ENVIRONMENT=staging \
DEPLOY_ENV_FILE=/secure/babyloop/staging.env \
DEPLOY_RELEASE_MANIFEST_PATH=.release/manifests/staging-....json \
pnpm deploy:acceptance
```

Çıktı `.release/evidence` altında JSON ve eşleşen `.sha256` dosyasıdır.

## Restore-smoke kanıtı

`pnpm ops:db:restore-smoke` artık yalnızca stdout üretmez. İzole restore tamamlandığında `restore_smoke` türünde checksum korumalı kanıt yazar.

```bash
TEST_DATABASE_URL=postgresql://... \
RESTORE_SMOKE_EVIDENCE_PATH=.release/evidence/restore-smoke.json \
pnpm ops:db:restore-smoke
```

Kanıt Git SHA, migration head, backup checksum ve geçici kaynak/hedef DB kimliklerini içerir.

## Galaxy S22 manuel kanıtı

`deploy/evidence/mobile-release-evidence.example.json` dosyasını repo dışında kopyala. Her kontrol yalnızca aynı build ve cihaz üzerinde gerçekten gözlendikten sonra `true` yapılmalıdır.

Zorunlu kontroller:

- cold start
- password login, MFA OTP ve login approval push
- session revoke
- 20'li browse pagination ve uzun scroll bellek davranışı
- listing create/edit/images
- favorites
- realtime messaging ve notification read state
- child notebook/reminder
- assistant safety
- basket/checkout simulation
- background/foreground recovery

Doldurulmuş dosyayı imzala:

```bash
pnpm deploy:evidence:sign -- \
  --input=/secure/evidence/mobile.json \
  --output=/secure/evidence/mobile.signed.json \
  --kind=mobile_release_evidence
```

## Gerçek sağlayıcı kanıtı

`deploy/evidence/provider-release-evidence.example.json` aynı staging SHA üzerinde şu gerçek bağımlılıkların smoke kanıtıdır:

- PostgreSQL read/write
- backup replica
- email delivery
- R2/S3 upload/read/delete
- push delivery
- Qdrant retrieval
- Redis connectivity
- analytics ingest
- notification ve child-reminder worker heartbeat
- error webhook

Dosya `provider_release_evidence` türüyle imzalanır. Provider check başarısızken `true` yazılmaz.

## Production GO receipt

Aşağıdaki dört kanıt aynı Git SHA'ya ait, checksum geçerli ve varsayılan olarak 72 saatten yeni olmalıdır:

1. staging deployment acceptance
2. restore smoke
3. Galaxy S22 mobile evidence
4. staging provider evidence

```bash
GO_NO_GO_STAGING_ACCEPTANCE_PATH=/secure/evidence/staging-acceptance.json \
GO_NO_GO_RESTORE_SMOKE_PATH=/secure/evidence/restore-smoke.json \
GO_NO_GO_MOBILE_EVIDENCE_PATH=/secure/evidence/mobile.signed.json \
GO_NO_GO_PROVIDER_EVIDENCE_PATH=/secure/evidence/providers.signed.json \
GO_NO_GO_OUTPUT_PATH=/secure/evidence/production-go.json \
pnpm release:go-no-go
```

Komut yalnızca tüm kanıtlar geçtiğinde `production_go_no_go` türünde `decision=GO` receipt üretir.

## Production promotion koruması

Production promotion artık aşağıdaki env olmadan başlamaz:

```text
DEPLOY_GO_NO_GO=GO
PRODUCTION_GO_NO_GO_RECEIPT_PATH=/secure/evidence/production-go.json
```

Promotion, Docker rollout veya migration öncesinde receipt checksum'unu, yaşını ve Git SHA eşleşmesini doğrular. Eski, değiştirilmiş veya farklı commit'e ait evidence production'a geçemez.

## Lokal release candidate preflight

External staging kaynakları kurulmadan önce repo kontratını doğrula:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test \
pnpm release:candidate:preflight
```

Bu komut deployment/backup/legal/acceptance guard'larını, evidence unit testlerini, readiness ve fresh-migration testlerini, bütün uygulama typecheck'lerini ve API/web/backoffice production build'lerini çalıştırır. Tam ürün regresyonlarının yerine geçmez; release candidate altyapısının bozulmadığını kanıtlar.

## CI durumu

`.github/workflows/ci.yml` yalnızca `workflow_dispatch` ile çalışır. Bu paket push veya pull request tetikleyicisi eklemez. GitHub Actions kotası yalnızca kullanıcı manuel release gate başlattığında tüketilir.


## Patch 21 additional evidence

The GO/NO-GO receipt now also requires `runtime_env_audit`, `staging_bootstrap_plan`, and `provider_probe_evidence` inputs. These inputs prove that the exact runtime configuration, immutable image digests, domain topology, Compose/Caddy configuration and live provider integrations were validated for the same Git SHA before production promotion.
