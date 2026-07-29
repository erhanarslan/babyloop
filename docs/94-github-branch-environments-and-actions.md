# GitHub branch, environment and Actions governance

## Branch modeli

- `dev`: lokal geliştirme entegrasyon branch'i. Uzak deployment yapmaz.
- `staging`: test ve kabul branch'i. Merge sonrası `Staging gate` çalışır.
- `master`: production branch'i. Merge sonrası `Production gate` çalışır.
- Günlük işler `feature/*`, `fix/*` veya `chore/*` branch'lerinde yapılır.

Promotion zinciri:

`feature/fix/chore -> dev -> staging -> master`

Protected branch'lere doğrudan push, force-push ve silme kapalıdır.
Merge yöntemi squash'tır.

## Public repository güvenlik modeli

Workflow YAML dosyaları ve Docker tanımları kaynak kodun parçasıdır ve
public tutulur. Gizli değerler hiçbir zaman bu dosyalara yazılmaz.

- PR CI ve güvenlik taramaları uygulama secret'ı kullanmaz.
- Fork PR'larına environment/repository secret aktarılmaz.
- Staging ve production cloud erişimi uzun ömürlü JSON anahtarıyla değil
  GitHub OIDC ve Google Workload Identity Federation ile kurulacaktır.
- Staging ve production değerleri ayrı GitHub Environment scope'larında tutulur.
- Uygulama runtime secret'larının kalıcı kaynağı Google Secret Manager'dır.
- Lokal runtime env dosyaları `~/.babyloop/env` altında ve repository dışında kalır.

## Workflow'lar

- `CI`: `dev`, `staging` veya `master` hedefli PR'larda çalışır.
- `Security`: PR, protected branch push, haftalık zamanlama ve manuel çağrıda çalışır.
- `Staging gate`: yalnız `staging` push/manuel çağrıda staging environment ile çalışır.
- `Production gate`: yalnız `master` push/manuel çağrıda production environment ile çalışır.
- Push ile çalışan staging/production gate'leri yalnız CI-safe lokal readiness
  (`pnpm deploy:check`) yürütür.
- Strict target readiness (`deploy:check:staging` / `deploy:check:production`),
  target runtime env, backup ve release evidence yüklendikten sonra guarded
  promotion akışı içinde çalıştırılır.
- `Container images` ve `Release E2E`: mevcut manuel operasyon araçlarıdır;
  otomatik deployment kurulana kadar korunur.

## Deployment aşaması

Bu değişiklik güvenli CI/release gate katmanını kurar. Cloud deployment
eklenmeden önce iki Google Cloud projesinde şunlar doğrulanır:

1. Workload Identity Pool ve GitHub provider
2. staging/production için ayrı deploy service account
3. branch ve environment claim koşulları
4. Artifact Registry ve Secret Manager yetkileri
5. GitHub Environment değişkenleri:
   - `GCP_PROJECT_ID`
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - `GCP_DEPLOY_SERVICE_ACCOUNT`
6. Cloud Run deploy, migration, smoke ve rollback kanıtı

Uzun ömürlü GCP service-account JSON anahtarı GitHub'a yüklenmez.
