<div align="center">

# CompeteHub

**A production-grade, full-stack platform for hosting data science competitions.**

A Kaggle-style monorepo featuring deterministic scoring, real-time leaderboards, public/private split evaluation, and battle-tested security controls.

[![Status](https://img.shields.io/badge/status-release--ready-success)]()
[![Tests](https://img.shields.io/badge/tests-269%20passing-brightgreen)]()
[![Node](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)]()
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)]()
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)]()

</div>

---

## Table of Contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start-development)
- [Production Deployment](#production-deployment)
- [API Documentation](#api-documentation)
- [Testing & Quality](#testing--quality)
- [Security](#security)
- [Operations](#operations)
- [Project Structure](#project-structure)
- [Documentation Index](#documentation-index)

---

## Highlights

- **End-to-end TypeScript** monorepo: Express API, BullMQ scoring worker, React 18 SPA, Nginx reverse proxy.
- **Deterministic public/private leaderboard** with seeded shuffling — same split for every submission in a competition, preventing overfit games.
- **Six built-in evaluation metrics** with both batch and single-pass streaming implementations: `ACCURACY`, `RMSE`, `F1_SCORE`, `AUC_ROC`, `LOG_LOSS`, `CUSTOM`.
- **Real-time updates** via Socket.IO rooms backed by Redis adapter (multi-instance safe) — leaderboard, submissions, and discussions refresh the moment events fire.
- **Hardened auth**: JWT access (15m) + rotating refresh tokens (7d HttpOnly cookie) with reuse detection, brute-force lockout, **email verification**, **TOTP 2FA with 8 backup codes**, OAuth (Google + strict-verified GitHub) with state validation and single-use exchange codes.
- **Defense-in-depth file pipeline**: magic-byte validation → ClamAV antivirus scan → SHA-256 dedupe → streaming MinIO upload, all inside Serializable transactions with BullMQ retries + DLQ.
- **Compliance-ready**: GDPR data export + account anonymize endpoints, AuditLog table for every admin and security-sensitive action, ToS / Privacy / Cookie consent UI.
- **Production observability**: Prometheus `/metrics` for backend + worker (HTTP latency, queue depth, scoring duration, websocket connections, failed-login spikes), Grafana dashboards, Alertmanager rules, OpenTelemetry OTLP tracing.
- **Domain features**: Badges + UserBadge with auto-evaluator on submission/vote/MFA/email events, Follow/follower system with denormalized counters, real-time discussion via Redis pub/sub, Settings page with Profile/Security/Notifications/Privacy tabs.
- **Operational safety**: stuck-submission recovery, auto-completion, daily DB backups (encrypted + S3-optional), graceful shutdown, health endpoints, distributed cron locks.
- **Independently audited**: 200+ backend tests + 45 worker tests + 40 frontend tests, plus 49 dedicated security tests (XSS, IDOR, JWT, race conditions, fairness rules) and Playwright smoke E2E in CI.

## Architecture

```
                       HTTPS
   ┌─────────┐   ┌──────────────┐
   │ Browser │──▶│    Nginx     │  TLS · HSTS · CSP · rate-limit · WS upgrade
   └─────────┘   └──────┬───────┘
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
       ┌─────────┐ ┌─────────┐ ┌──────────┐
       │Frontend │ │ Backend │◀│ Socket.IO│  JWT-auth on handshake
       │ (Nginx) │ │ Express │ └──────────┘
       └─────────┘ └────┬────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │PostgreSQL│    │  Redis   │    │  MinIO   │
   │ (Prisma) │    │ pub/sub  │    │ (S3 API) │
   └──────────┘    │ + cache  │    └──────────┘
        ▲         │ + BullMQ │         ▲
        │         └────┬─────┘         │
        │         ┌────▼─────┐         │
        └─────────┤  Worker  ├─────────┘
                  │ (BullMQ) │
                  └──────────┘
```

**Network isolation (production)**: three Docker networks — `frontend`, `backend`, `data`. Datastores live exclusively in `data` and are unreachable from the public network.

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, TypeScript, Vite 6, Tailwind CSS 3, Zustand, TanStack Query 5, Axios, Socket.IO client, Recharts, Sentry |
| **Backend** | Node 20, Express 4, Prisma 6, Zod, Passport, jsonwebtoken, bcryptjs, Helmet, sanitize-html, Pino, Sentry, Swagger, otplib (TOTP), clamscan (ClamAV) |
| **Worker** | BullMQ 5, csv-parse, ioredis, MinIO SDK, custom deterministic LCG splitter, streaming single-pass scorers |
| **Datastores** | PostgreSQL 16 (with `pg_trgm` for search), Redis 7 (cache + pub/sub + Socket.IO adapter), MinIO (S3-compatible) |
| **Observability** | Prometheus + Grafana + Alertmanager (`monitoring/`), OpenTelemetry SDK with OTLP exporter, Sentry, Pino JSON logs |
| **Security** | ClamAV daemon, OAuth state via Redis, JWT HS256 with `iss`/`aud`, refresh-token rotation w/ reuse detection, audit_log table |
| **Infrastructure** | Docker Compose, multi-stage builds, non-root containers, Nginx (TLS 1.2+1.3, rate-limit zones, ip_hash for sockets) |
| **Testing** | Jest, Vitest, Supertest, Testing Library, MSW, Playwright (E2E) |
| **CI/CD** | GitHub Actions: security audit · backend · frontend · worker · docker build · Playwright smoke E2E |
| **DevEx** | Dependabot (npm + docker + actions), CODEOWNERS, PR + issue templates, ESLint + security plugin, Prettier |

## Quick Start (Development)

**Prerequisites:** Node.js 20+, Docker & Docker Compose, Git.

```bash
cp .env.example .env
docker compose up -d postgres redis minio

cd backend  && npm install && npx prisma migrate dev && npx prisma db seed && cd ..
cd frontend && npm install && cd ..
cd worker   && npm install && cd ..
```

Run each service in its own terminal:

```bash
cd backend  && npm run dev    # API on :3000
cd frontend && npm run dev    # SPA on :5173
cd worker   && npm run dev    # health on :3001
```

Open http://localhost:5173 and sign in with the seeded credentials (see `backend/prisma/seed.ts`).

## Production Deployment

### 1. Configure secrets

```bash
cp .env.example .env
# Generate strong secrets (≥ 32 chars, validated at startup):
openssl rand -hex 64   # JWT_ACCESS_SECRET
openssl rand -hex 64   # JWT_REFRESH_SECRET
```

Required production variables (the app refuses to start otherwise):

- `DATABASE_URL` with `?sslmode=require`
- `REDIS_URL` with password (`redis://:<password>@redis:6379`)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — both ≥ 32 chars, never the placeholder
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` — must not be `minioadmin`
- `FRONTEND_URL`, `API_URL`, `OAUTH_CALLBACK_URL`, `NODE_ENV=production`

Optional but recommended: `SENTRY_DSN`, OAuth credentials, SMTP, `S3_BACKUP_BUCKET`, `BACKUP_ENCRYPTION_KEY`.

### 2. Provision TLS

Place `fullchain.pem` and `privkey.pem` in `nginx/ssl/`. Nginx terminates TLS 1.2/1.3 with HSTS, strict CSP, and per-route rate-limit zones (`api`, `login`, `upload`).

### 3. Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed   # first run only
```

The backend container automatically runs `prisma migrate deploy` on every start. All services run as a non-root user (UID/GID `1001`), with healthchecks, memory limits, and `unless-stopped` restart policy. The `db-backup` sidecar takes a daily `pg_dump | gzip` snapshot with 7-day retention.

For the full pre-flight checklist see [`HANDOFF_CHECKLIST.md`](./HANDOFF_CHECKLIST.md).

## API Documentation

- **Interactive docs**: http://localhost:3000/api/docs (Swagger UI, dev only)
- **Base URL**: `/api/v1`
- **Response shape**:
  ```json
  { "success": true, "data": {}, "message": "...", "pagination": {} }
  ```
- **Auth**: `Authorization: Bearer <accessToken>` for API; refresh handled via HttpOnly cookie scoped to `/api/v1/auth/refresh`.

| Domain | Prefix | Notes |
|--------|--------|-------|
| Auth | `/auth` | register, login, refresh, OAuth (Google/GitHub), forgot/reset password |
| Competitions | `/competitions` | CRUD, FSM status, search, filter, slug lookup |
| Datasets | `/competitions/:id/datasets` | upload (host only), download (presigned), preview |
| Submissions | `/competitions/:id/submissions` | CSV upload, list, select-for-private |
| Leaderboard | `/competitions/:id/leaderboard` | public, private (gated), shakeup, CSV export |
| Discussion | `/competitions/:id/discussions` | threads, replies (≤ 2 levels), votes, pins |
| Teams | `/teams` | create, invite, accept/reject |
| Notifications | `/notifications` | paginated list, unread count, mark read |
| Admin | `/admin` | dashboard, user management, competition review |

## Testing & Quality

```bash
cd backend  && npm test         # Jest        — 198/198 pass (~11s, 16 suites)
cd frontend && npm test         # Vitest      — component + store + util tests
cd worker   && npm test         # Jest        — scorer suite

# Coverage
cd backend && npm run test:coverage
```

**Quality gates**:

- `tsc --noEmit` clean across all three packages
- `npm audit --audit-level=high` enforced in CI
- 49 dedicated security tests covering XSS payloads, JWT tampering, IDOR, race conditions, fairness rules and private-leaderboard access
- Independent audit artifacts: see [`AUDIT_REPORT_INDEPENDENT_20260417.md`](./AUDIT_REPORT_INDEPENDENT_20260417.md) and [`audit-artifacts-v2/INDEX.md`](./audit-artifacts-v2/INDEX.md)

## Security

Defense-in-depth implemented across the stack:

| Concern | Control |
|---------|---------|
| **Passwords** | bcrypt cost 12 · 8–128 chars · upper/lower/digit policy · 5-strike 15-min lockout |
| **Tokens** | JWT HS256 with pinned `iss` + `aud` · refresh stored as SHA-256 hash · automatic rotation with reuse detection |
| **OAuth** | Single-use `state` param (Redis TTL 600s) · email-verified gate · single-use exchange codes (TTL 60s) |
| **CSRF** | Origin/Referer validation on state-changing requests · `SameSite=Strict` cookies |
| **XSS** | `sanitize-html` on every user-submitted text field at create *and* update paths · `rehype-sanitize` on rendered Markdown |
| **IDOR** | Vote service scoped per-competition; resource ownership checks on every mutation |
| **Race conditions** | Submission dedupe + quota checks inside `Serializable` transactions |
| **File uploads** | Multer disk storage (no memory buffer) · magic-byte sniffing · UUID-prefixed sanitized filenames · streaming upload to MinIO |
| **Rate limiting** | Redis-backed per-route limits + Nginx zones (`api 10r/s`, `login 1r/s`, `upload 2r/s`) |
| **Transport** | TLS 1.2+1.3 · HSTS (1y, includeSubDomains) · strict CSP · X-Frame-Options DENY |
| **Logging** | Pino redacts auth headers, cookies, secrets, hashes · Sentry `beforeSend` scrubs PII |
| **Startup** | Refuses to boot in production if JWT secrets are weak or MinIO uses default credentials |

Full changelog: [`SECURITY_FIXES.md`](./SECURITY_FIXES.md). Test evidence: [`TEST_EVIDENCE.md`](./TEST_EVIDENCE.md).

## Operations

### Health checks

```bash
curl https://your-host/api/health      # backend: postgres + redis + minio probe
curl http://worker-host:3001/          # worker: redis ping + drain status
```

### Backups

```bash
# Manual encrypted backup with optional S3 upload
./scripts/backup-db.sh

# Restore (interactive confirmation)
./scripts/restore-db.sh backups/backup_20260417_030000.sql.gz
```

The internal `db-backup` container runs the same flow daily and rotates files older than 7 days. Set `BACKUP_ENCRYPTION_KEY` and `S3_BACKUP_BUCKET` for offsite, encrypted retention.

### Scheduled jobs

All cron jobs guard against multi-instance double-execution via Redis `SET NX EX 120`:

- `*/5 * * * *` — recover stuck submissions (timeout > 10 min)
- `*/5 * * * *` — auto-complete competitions past `endDate` and select best private submissions
- `0 3 * * *`   — purge read notifications older than 90 days

### Observability

- **Logs**: Pino JSON in production, `pino-pretty` in dev. Each request carries an `x-request-id` propagated through Nginx.
- **Errors**: Sentry on backend (`@sentry/node`) and frontend (`@sentry/react`) with PII scrubbing and dynamic sample rates.
- **Metrics**: health endpoints + Docker healthchecks; Prometheus exporter is on the roadmap (see [`KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md)).

## Project Structure

```
.
├── backend/          Express API · Prisma · Socket.IO · BullMQ producer
│   ├── prisma/       Schema, migrations, init.sql (pg_trgm), seed
│   └── src/
│       ├── config/   database, redis, minio, socket, passport, sentry, swagger
│       ├── middleware/  auth, validate, errorHandler, csrf
│       ├── modules/  auth · competition · dataset · enrollment · submission ·
│       │             leaderboard · discussion · team · notification · user · admin
│       ├── services/ storage, email
│       ├── jobs/     scheduledJobs (cron)
│       └── tests/    security, fairness, helpers
├── worker/           BullMQ consumer · scorers · health server
├── frontend/         React 18 SPA (Vite, Tailwind, Zustand, TanStack Query)
├── nginx/            TLS, rate-limit zones, SPA fallback, WebSocket upgrade
├── scripts/          backup-db.sh, restore-db.sh
├── .github/workflows ci.yml — 4 parallel jobs + docker build
├── docker-compose.yml          Dev (hot reload, no TLS)
├── docker-compose.prod.yml     Prod (multi-stage, non-root, healthchecks, db-backup)
└── .env.example
```

Each backend module follows the same pattern:

```
modules/<name>/
  <name>.routes.ts       Express router + middleware wiring
  <name>.controller.ts   Thin: extract req → call service → sendSuccess
  <name>.service.ts      Business logic, Prisma transactions
  <name>.validator.ts    Zod schemas + inferred types
  <name>.service.test.ts Unit tests
```

## Documentation Index

| Document | Purpose |
|----------|---------|
| [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) | Single source of truth — full system reference for engineers and AI agents |
| [`HANDOFF_CHECKLIST.md`](./HANDOFF_CHECKLIST.md) | Pre-deployment checklist (env, secrets, SSL, smoke tests) |
| [`RELEASE_READINESS.md`](./RELEASE_READINESS.md) | Release sign-off report |
| [`SECURITY_FIXES.md`](./SECURITY_FIXES.md) | Vulnerability remediation log |
| [`TEST_EVIDENCE.md`](./TEST_EVIDENCE.md) | Detailed test results and coverage |
| [`KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md) | Known issues and roadmap items |
| [`OAUTH_SETUP.md`](./OAUTH_SETUP.md) | Google & GitHub OAuth provisioning guide |
| [`AUDIT_REPORT_INDEPENDENT_20260417.md`](./AUDIT_REPORT_INDEPENDENT_20260417.md) | Independent third-party audit |

## Contributing

Conventions enforced across the codebase:

- TypeScript strict mode, no narration comments — code must be self-explanatory; comments only explain *why*, not *what*.
- `camelCase` for variables and functions, `PascalCase` for components and classes, `snake_case` for database columns (mapped via Prisma `@map`).
- No hardcoded values — use `config/index.ts`, environment variables, or shared constants.
- Reuse over duplication — shared logic belongs in `services/` or `utils/`.
- Single responsibility per function/class; predictable side effects.
- Backward compatibility is mandatory — schema and API changes must migrate existing data.
- Pagination is capped at `limit=100` server-side.
- Multi-step writes that can race must use `prisma.$transaction(..., { isolationLevel: 'Serializable' })`.

Before opening a PR: `npm test`, `tsc --noEmit`, and `npm run build` must all pass for every package you touched.

---

<div align="center">

Built with care. See [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) for the deep dive.

</div>
