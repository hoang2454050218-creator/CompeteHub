# KNOWN LIMITATIONS

> Updated 2026-04-18 after Phase 0-4 production-grade upgrade.

## Closed in this iteration (was open in audit-v2)

| Item | Resolution |
|---|---|
| #1 Socket.IO rate limit in-memory | Replaced with Redis `INCR + EXPIRE` per `userId`; multi-instance safe. See `backend/src/config/socket.ts`. |
| #2 Worker reads full CSV into memory | Refactored to streaming generator + `Float32Array` truth index + single-pass scorers (ACCURACY/RMSE/LOG_LOSS/F1). AUC_ROC keeps batch but groups by class to halve memory. See `worker/src/scorers/streaming.ts`. |
| #3 No virus/malware scanning | ClamAV integrated via `clamscan`; injected after magic-byte validation in submission + dataset upload paths. Service in `docker-compose.prod.yml`. |
| #4 No email verification for local signup | New flow: `POST /auth/verify-email`, `POST /auth/resend-verification`, gated login (`REQUIRE_EMAIL_VERIFY` env, default true in prod). Frontend page `/verify-email`. |
| #5 GitHub OAuth doesn't strict-verify email | Now requires explicit `verified === true` from `passport-github2` `user:email` scope. |
| #6 Default seed credentials public | `prisma/seed.ts` already refuses populated prod DBs unless `ALLOW_PRODUCTION_SEED=true`. New onboarding flow forces email verify before login. |
| #7 Backend test coverage ~57% | Added `mfa.service.test`, `user.service.test`, `follow.service.test`, `badge.service.test`. Worker added `streaming.test` (10 tests). |
| #8 No centralized metrics | Prometheus + Grafana + Alertmanager added in `docker-compose.prod.yml` and `monitoring/`. Backend exposes `/metrics`; worker exposes `/metrics` on health port. Five default alert rules. |
| #9 `autoSelectBestSubmissions` race | Rewritten as single `SELECT DISTINCT ON (user_id) ... UPDATE` raw SQL inside Serializable transaction. See `backend/src/jobs/scheduledJobs.ts`. |
| #10 Swagger covered ~12% endpoints | Added inline path entries for auth/MFA/email-verify/GDPR/follow/badges/admin audit-logs. Roadmap: full Zod-to-OpenAPI generation via `@asteasolutions/zod-to-openapi`. |
| L-01 enrollment.unenroll Serializable | Already shipped in audit-v2 (verified). |

## Remaining (low priority)

### 1. Notebook / kernel submissions stored but not auto-scored
- Schema supports `submissionType ∈ {CSV, NOTEBOOK, SCRIPT}` and `kernelUrl`.
- Worker only auto-scores `CSV`. NOTEBOOK / SCRIPT need a manual review flow or a sandboxed runner.
- Roadmap: integrate Jupyter/Papermill executor in a quarantined container.

### 2. Full Zod-to-OpenAPI auto-generation pending
- `@asteasolutions/zod-to-openapi` installed; current Swagger is hand-curated covering ~30+ endpoints.
- Migration to fully generated spec is straightforward but requires touching every `*.validator.ts`.

### 3. Mutation testing config present, not wired into CI
- `worker/stryker.conf.json` exists; runs locally with `npx stryker run`.
- CI integration deferred (long runtime, run on demand).

### 4. Notebook viewer in frontend
- Notebook submissions currently shown as raw download. Roadmap: `react-jupyter-notebook` viewer.

### 5. ClamAV cold-start
- First scan after container start can be slow (signature DB load). Healthcheck has 120s start_period; submissions during this window briefly fall back to fail-open unless `ANTIVIRUS_REQUIRED=true`.

### 6. Worker test count drift
- Was 35 tests; now 45 with streaming tests. Earlier audit reports referencing 32 should be ignored — tests pass 45/45.

## Infrastructure assumptions (unchanged)

- SSL certificates must be provisioned and placed in `nginx/ssl/` before production deploy.
- DNS must be configured before go-live.
- MinIO must not use default credentials in production (enforced by startup validation).
- PostgreSQL should use `sslmode=require` in production DATABASE_URL.
- For multi-host deployments: `app.set('trust proxy', N)` should be set to actual hop count (currently `1`).
- For multi-instance backend: nginx upstream needs `ip_hash` for `/socket.io/` if not using sticky sessions.
- Monitoring stack (Prometheus / Grafana / Alertmanager) is on the internal `backend` Docker network — expose via reverse proxy with strict auth before opening externally.
- ClamAV container needs ~2 GB memory and time to download signatures on first start.
- OpenTelemetry exporter is opt-in via `OTEL_EXPORTER_OTLP_ENDPOINT` env. Without it, no spans are emitted (zero overhead).

## Environment variable additions

| Variable | Default | Purpose |
|---|---|---|
| `REQUIRE_EMAIL_VERIFY` | `true` | Gate login on verified email |
| `MFA_ISSUER` | `CompeteHub` | TOTP issuer label |
| `METRICS_TOKEN` | (none) | Bearer token guarding `/metrics` (otherwise IP-allowlisted) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (none) | OpenTelemetry OTLP HTTP collector URL |
| `OTEL_SERVICE_NAME` | `competehub-backend` / `-worker` | Service name in spans |
| `CLAMAV_HOST` | (none) | ClamAV daemon host; absent → scans skipped |
| `CLAMAV_PORT` | `3310` | ClamAV daemon port |
| `ANTIVIRUS_REQUIRED` | `false` | Fail-close vs fail-open if ClamAV unreachable |
| `MAX_SCORING_FILE_SIZE` | `524288000` (500 MB) | Override worker file size cap |
| `MAX_CSV_ROWS` | `5000000` | Override worker row cap |
| `WORKER_HEALTH_PORT` | `3001` | Worker health + metrics port |
| `GRAFANA_ADMIN_PASSWORD` | `changeme` | Grafana admin password (set in production!) |
