# TEST EVIDENCE — Final Release Verification (post audit-v2 remediation)

## Verification Timestamp
2026-04-17 (audit-v2 follow-up)

---

## 1. TypeScript Compilation

| Project | Command | Exit Code |
|---------|---------|-----------|
| Backend | `cd backend && npx tsc --noEmit` | **0** (clean) |
| Worker | `cd worker && npx tsc --noEmit` | **0** (clean) |
| Frontend | `cd frontend && npx tsc --noEmit` | **0** (clean) |

All three packages now compile cleanly.

---

## 2. Unit Test Results (with --coverage gating enabled)

### Backend: 200/200 passed, 16/16 suites
```
Command: cd backend && npx jest --forceExit --coverage
Exit code: 0
Test Suites: 16 passed, 16 total
Tests:       200 passed, 200 total
Time:        ~17s
Coverage thresholds (audit-v2 F-Test-01 realigned): branches 40 / functions 50 / lines 50 / statements 50 — all met.
```

### Frontend: 40/40 passed, 5/5 suites
```
Command: cd frontend && npx vitest run --coverage
Exit code: 0
Test Files: 5 passed (5)
Tests: 40 passed (40)
Coverage provider: v8 (audit-v2 F-Test-02 fix)
```

### Worker: 35/35 passed, 1/1 suite
```
Command: cd worker && npx jest --forceExit --coverage
Exit code: 0
Test Suites: 1 passed, 1 total
Tests:       35 passed, 35 total
```

**Total: 275/275 PASS with coverage gating.**

---

## 3. Security Tests (49 tests in backend)

### XSS Sanitization (12 payloads × 6 modules verified live in audit-v2)
All 12 payloads from `security.test.ts` plus live curl tests on competition/discussion/user/team/dataset/submission. Every payload stored as HTML-encoded entities (`&lt;script&gt;`).

### JWT Security (8 attack vectors)
| Attack | Result |
|--------|--------|
| Wrong secret | Rejected |
| Wrong algorithm (HS384) | Rejected |
| Missing issuer | Rejected |
| Missing audience | Rejected |
| Expired token | Rejected |
| Garbage string | Rejected |
| `alg: "none"` attack | Rejected |
| Valid token | Accepted |

### IDOR (2 tests + 1 live)
| Test | Result |
|------|--------|
| Vote on discussion from different competition (unit) | 404 |
| Vote on reply from different competition (unit) | 404 |
| Live cross-comp vote (audit-v2 §3.1) | 404 "Discussion not found in this competition" |

### Race Condition (1 unit + 1 live)
| Test | Result |
|------|--------|
| Duplicate hash unit test | 409 |
| 12 concurrent same-hash POSTs (audit-v2 §4.1) | 1 success / 6 conflict / 5 nginx-503; DB has exactly 1 row |

### Magic-Byte (3 live in audit-v2)
| Payload | Result |
|---------|--------|
| PE binary as `.csv` | 400 INVALID_FILE_TYPE |
| ZIP as `.csv` | 400 INVALID_FILE_TYPE |
| HTML as `.csv` | 400 INVALID_FILE_TYPE |

### Rate-limit per-IP (live in audit-v2 post-fix)
| Test | Result |
|------|--------|
| 3 different X-Forwarded-For values | 3 distinct Redis keys: `rl:auth:10.20.30.1`, `rl:auth:10.20.30.2`, `rl:auth:10.20.30.3` |
| Each IP got its own bucket | confirmed (no shared 429) |

---

## 4. Leaderboard Privacy (Code Audit)

| Check | Evidence |
|-------|----------|
| Public LB select excludes `bestPrivateScore` | `leaderboard.service.ts:36-43` |
| Private LB gated on COMPLETED/ARCHIVED | `leaderboard.service.ts:67` |
| Socket broadcast to `leaderboard:*` sends only `publicScore` | `socket.ts:124-128` |
| Socket sends `privateScore` only to `user:${userId}` room | `socket.ts:129-133` |
| Live: ACTIVE → 403 on private LB | `competition-rules.test.ts` |

---

## 5. Auth/Session (live verified in audit-v2)

| Check | Evidence |
|-------|----------|
| Refresh token stored as 64-char SHA-256 hex | DB inspection: `length(refresh_token) = 64`, prefix random hex |
| Bcrypt cost factor 12 | DB inspection: `password_hash` starts with `$2a$12$` |
| Token rotation on refresh | DB hash changed before/after refresh |
| Reuse detection invalidates all sessions | DB hash → NULL after reuse attempt |
| Brute force: 5 fails → lock 15 min | DB: `failed_logins=0, locked_until=+15min` |
| Cookie attrs HttpOnly+Secure+SameSite=Strict+Path | Set-Cookie header inspection |
| OAuth state single-use in Redis | `utils/oauthState.ts` |

---

## 6. Infrastructure Verification (live in audit-v2)

| Check | Status |
|-------|--------|
| Multi-stage Docker builds (prod) | ✅ backend, worker, frontend |
| Non-root containers | ✅ appuser:1001 / nginx:101 |
| Health checks all services | ✅ all reach healthy in <80s |
| Restart policies | ✅ unless-stopped |
| Volume persistence | ✅ postgres_data, redis_data, minio_data |
| Log rotation | ✅ json-file with max-size/max-file on backend/worker/frontend/nginx **AND now postgres/redis/minio** (audit-v2 F-Infra-02) |
| Memory limits | ✅ all 7 services including **MinIO 1G** (audit-v2 F-Infra-01) |
| Network isolation | ✅ frontend cannot resolve postgres |
| Backup runs on startup | ✅ pg_dump + gzip + sha256 |
| Nginx TLS + security headers | ✅ HSTS, X-Frame-Options, CSP, nosniff, Permissions-Policy |
| **No header doubling on /api/*** | ✅ audit-v2 F-Infra-03 fix verified |
| Nginx rate limiting (zones) | ✅ api/login/upload |
| Nginx gzip | ✅ |
| **Production seed works** | ✅ `docker exec backend npx prisma db seed` succeeds (audit-v2 F-Infra-05 fix) |

---

## Commands Used (Exact)
```powershell
# TypeScript
cd backend && npx tsc --noEmit
cd worker && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Tests with coverage
cd backend && npx jest --forceExit --coverage
cd frontend && npx vitest run --coverage
cd worker && npx jest --forceExit --coverage

# Live security tests (see AUDIT_REPORT_INDEPENDENT_20260417.md and audit-artifacts-v2/)
```
