# 91 — Domain, DNS, TLS and Cutover Runbook

## Domain model

Use three separate HTTPS origins:

| Surface | Staging example | Production example |
| --- | --- | --- |
| Public web | `staging.<domain>` | `<domain>` |
| API | `api.staging.<domain>` | `api.<domain>` |
| Backoffice | `admin.staging.<domain>` | `admin.<domain>` |
| Image CDN | `cdn.staging.<domain>` | `cdn.<domain>` |

The runtime audit requires web, API and backoffice origins to be distinct. `CORS_ORIGINS` must include public web and backoffice, and must not use wildcard origins.

## DNS sequence

1. Provision the host and obtain its public IP.
2. Create staging A/AAAA records with a low TTL such as 300 seconds.
3. Confirm records from at least two resolvers.
4. Start Caddy with the staging domains.
5. Confirm valid TLS chains before exposing account flows.
6. Keep production records unchanged until staging GO evidence is complete.
7. Reduce production TTL before cutover.
8. Cut over one surface at a time: API, web, then backoffice.
9. Restore the normal TTL after the observation window.

## Reverse proxy

`deploy/proxy/Caddyfile.example` includes:

- automatic HTTPS,
- zstd/gzip,
- HSTS,
- MIME sniffing protection,
- strict referrer policy,
- restrictive permissions policy,
- JSON access logs to stdout,
- `X-Robots-Tag` blocking for backoffice.

Do not add permissive CORS headers at the proxy. CORS remains an API policy.

## Pre-cutover checks

```bash
curl -fsS https://api.staging.<domain>/health/live
curl -fsS https://api.staging.<domain>/health/ready
curl -I https://staging.<domain>/
curl -I https://admin.staging.<domain>/
```

Validate:

- certificate subject/SAN,
- HSTS header,
- no server banner,
- backoffice `X-Robots-Tag`,
- CSP from the application,
- no HTTP-to-HTTPS loop,
- no direct public access to ports 3000, 3001 or 4000.

## Cookie and OAuth checks

- `WEB_APP_URL` and `NEXT_PUBLIC_SITE_URL` must match.
- `BABYLOOP_API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL` must match.
- Google redirect URI must use the deployed API origin and `/api/v1/auth/google/callback`.
- Secure cookies must remain HTTPS-only.
- Staging and production OAuth clients should be separated when the provider allows it.

## Rollback

DNS rollback is not the first response to an application regression. Prefer:

1. stop promotion,
2. invoke the release rollback plan with previous digest-pinned images,
3. validate API readiness,
4. rerun post-deploy smoke,
5. change DNS only when the host/proxy layer itself is unavailable.

Record the rollback receipt and preserve failed release evidence for review.
